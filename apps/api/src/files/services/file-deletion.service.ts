import { Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import * as schema from '../../database/drizzle/schema';
import { OrgUsageService } from '../../organizations/services/org-usage.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { VariantsRepository } from '../../variants/repositories/variants.repository';
import { FilesRepository } from '../repositories/files.repository';

@Injectable()
export class FileDeletionService {
  private readonly logger = new Logger(FileDeletionService.name);

  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly variantsRepository: VariantsRepository,
    private readonly storageFactory: StorageFactoryService,
    private readonly databaseService: DatabaseService,
    private readonly usageService: OrgUsageService,
  ) {}

  /**
   * Soft delete a file - marks as deleted but keeps record.
   * Quota is not freed until hard purge (soft-deleted files still occupy storage).
   */
  async softDelete(fileId: string): Promise<boolean> {
    const file = await this.filesRepository.findById(fileId);
    if (!file) {
      throw new Error(`File ${fileId} not found`);
    }

    if (file.deletedAt) {
      this.logger.warn(`File ${fileId} is already soft deleted`);
      return false;
    }

    // Decrement reference count
    const updated = await this.filesRepository.decrementReferenceCount(fileId);

    if (updated && updated.referenceCount === 0) {
      // Mark as soft deleted
      await this.filesRepository.softDelete(fileId);
      this.logger.log(`File ${fileId} soft deleted (reference count: 0)`);
      return true;
    }

    this.logger.log(`File ${fileId} reference count decremented to ${updated?.referenceCount}`);
    return false;
  }

  /**
   * Hard delete a file - permanently removes file and storage
   */
  async hardDelete(fileId: string, force = false): Promise<boolean> {
    const file = await this.filesRepository.findById(fileId);
    if (!file) {
      throw new Error(`File ${fileId} not found`);
    }

    // Check if file is soft deleted or has no references
    if (!force && !file.deletedAt && file.referenceCount > 0) {
      throw new Error(
        `Cannot hard delete file ${fileId}: not soft deleted and reference count is ${file.referenceCount}`,
      );
    }

    try {
      // Delete all variants first
      const variants = await this.variantsRepository.findByFileId(fileId);
      for (const variant of variants) {
        try {
          const provider = await this.storageFactory.getProvider(variant.storageProviderId);
          await provider.delete(variant.variantKey);
          await this.variantsRepository.delete(variant.id);
          this.logger.log(`Deleted variant ${variant.id} (${variant.variantKey})`);
        } catch (error) {
          this.logger.warn(`Failed to delete variant ${variant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Delete main file from storage
      const provider = await this.storageFactory.getProvider(file.storageProviderId);
      await provider.delete(file.storageKey);
      this.logger.log(`Deleted file from storage: ${file.storageKey}`);

      const orgId = file.orgId;
      const size = file.size;

      // Delete database record (cascade will handle related records)
      await this.filesRepository.delete(fileId);
      this.logger.log(`Hard deleted file ${fileId}`);

      try {
        await this.usageService.decrement(orgId, size);
      } catch (error) {
        this.logger.warn(
          `Failed to decrement usage for org ${orgId} after hard delete: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to hard delete file ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted file
   */
  async restore(fileId: string): Promise<boolean> {
    const file = await this.filesRepository.findById(fileId);
    if (!file) {
      throw new Error(`File ${fileId} not found`);
    }

    if (!file.deletedAt) {
      this.logger.warn(`File ${fileId} is not soft deleted`);
      return false;
    }

    await this.filesRepository.restore(fileId);
    this.logger.log(`Restored file ${fileId}`);
    return true;
  }

  /**
   * Cleanup orphaned files (soft deleted files older than retention period).
   * When orgId is set, only that organization is scanned.
   */
  async cleanupOrphanedFiles(
    retentionDays = 30,
    orgId?: string,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const db = this.databaseService.getDb();
    const conditions = [
      sql`${schema.files.deletedAt} IS NOT NULL`,
      eq(schema.files.referenceCount, 0),
    ];
    if (orgId) {
      conditions.push(eq(schema.files.orgId, orgId));
    }

    const orphanedFiles = await db
      .select()
      .from(schema.files)
      .where(and(...conditions));

    let deletedCount = 0;
    for (const file of orphanedFiles) {
      if (file.deletedAt && file.deletedAt < cutoffDate) {
        try {
          await this.hardDelete(file.id, true);
          deletedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to cleanup file ${file.id}: ${errorMessage}`);
        }
      }
    }

    this.logger.log(
      `Cleaned up ${deletedCount} orphaned files${orgId ? ` for org ${orgId}` : ''} (retention ${retentionDays}d)`,
    );
    return deletedCount;
  }

  /**
   * Cleanup files with zero references that aren't soft deleted
   */
  async cleanupUnreferencedFiles(): Promise<number> {
    const db = this.databaseService.getDb();
    const unreferencedFiles = await db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.referenceCount, 0),
          isNull(schema.files.deletedAt),
        ),
      );

    let deletedCount = 0;
    for (const file of unreferencedFiles) {
      try {
        await this.softDelete(file.id);
        deletedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to cleanup unreferenced file ${file.id}: ${errorMessage}`);
        }
    }

    this.logger.log(`Cleaned up ${deletedCount} unreferenced files`);
    return deletedCount;
  }
}
