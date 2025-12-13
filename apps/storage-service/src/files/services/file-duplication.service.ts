import { Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import * as schema from '../../database/schema/schema';
import { FilesRepository } from '../repositories/files.repository';

@Injectable()
export class FileDuplicationService {
  private readonly logger = new Logger(FileDuplicationService.name);

  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Detect duplicates by SHA-256 hash
   */
  async detectDuplicatesByHash(fileHash: string): Promise<typeof schema.files.$inferSelect[]> {
    const db = this.databaseService.getDb();
    return db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.fileHash, fileHash),
          isNull(schema.files.deletedAt), // Only active files
        ),
      );
  }

  /**
   * Mark file as duplicate and link to original
   * Single source of truth: fileDuplicates table
   */
  async markAsDuplicate(
    duplicateFileId: string,
    originalFileId: string,
    detectionMethod: 'sha256' | 'content' | 'manual' | 'ai' = 'sha256',
    similarityScore?: number,
  ) {
    const db = this.databaseService.getDb();

    // Create duplicate relationship record (single source of truth)
    await db.insert(schema.fileDuplicates).values({
      originalFileId,
      duplicateFileId,
      detectionMethod,
      similarityScore,
    });

    // Increment reference count of original
    await this.filesRepository.incrementReferenceCount(originalFileId);

    this.logger.log(
      `Marked file ${duplicateFileId} as duplicate of ${originalFileId} (method: ${detectionMethod})`,
    );
  }

  /**
   * Get all duplicates of a file
   */
  async getDuplicates(fileId: string) {
    const db = this.databaseService.getDb();
    return db
      .select()
      .from(schema.fileDuplicates)
      .where(eq(schema.fileDuplicates.originalFileId, fileId));
  }

  /**
   * Get the original file if this is a duplicate
   * Single source of truth: fileDuplicates table
   */
  async getOriginalFile(fileId: string) {
    const db = this.databaseService.getDb();
    const duplicate = await db
      .select()
      .from(schema.fileDuplicates)
      .where(eq(schema.fileDuplicates.duplicateFileId, fileId))
      .limit(1);

    if (duplicate.length > 0) {
      return this.filesRepository.findById(duplicate[0].originalFileId);
    }
    return null;
  }

  /**
   * Check if file is a duplicate
   * Single source of truth: fileDuplicates table
   */
  async isDuplicate(fileId: string): Promise<boolean> {
    const db = this.databaseService.getDb();
    const duplicate = await db
      .select()
      .from(schema.fileDuplicates)
      .where(eq(schema.fileDuplicates.duplicateFileId, fileId))
      .limit(1);

    return duplicate.length > 0;
  }

  /**
   * Consolidate duplicates - merge all duplicates into original
   */
  async consolidateDuplicates(originalFileId: string): Promise<number> {
    const duplicates = await this.getDuplicates(originalFileId);
    let consolidated = 0;

    for (const dup of duplicates) {
      try {
        // Transfer any metadata/tags from duplicate to original if needed
        // Then soft delete the duplicate
        const file = await this.filesRepository.findById(dup.duplicateFileId);
        if (file && !file.deletedAt) {
          await this.filesRepository.softDelete(dup.duplicateFileId);
          consolidated++;
        }
      } catch (error) {
        this.logger.error(`Failed to consolidate duplicate ${dup.duplicateFileId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    this.logger.log(`Consolidated ${consolidated} duplicates into original file ${originalFileId}`);
    return consolidated;
  }

  /**
   * Smart duplicate detection strategy:
   * 1. Check by hash (fastest)
   * 2. If found, check if already marked as duplicate
   * 3. If not marked, create duplicate relationship
   */
  async smartDuplicateDetection(
    fileHash: string,
    fileId: string,
  ): Promise<{ isDuplicate: boolean; originalFileId?: string }> {
    const duplicates = await this.detectDuplicatesByHash(fileHash);

    // Filter out the current file
    const otherDuplicates = duplicates.filter((f) => f.id !== fileId);

    if (otherDuplicates.length === 0) {
      return { isDuplicate: false };
    }

    // Use the oldest file as the original
    const original = otherDuplicates.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )[0];

    // Mark current file as duplicate if not already marked
    const isAlreadyDuplicate = await this.isDuplicate(fileId);
    if (!isAlreadyDuplicate) {
      await this.markAsDuplicate(fileId, original.id, 'sha256');
    }

    return { isDuplicate: true, originalFileId: original.id };
  }
}

