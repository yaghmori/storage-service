import { Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import * as schema from '../../database/drizzle/schema';
import { FilesRepository } from '../repositories/files.repository';

@Injectable()
export class FileDuplicationService {
  private readonly logger = new Logger(FileDuplicationService.name);

  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly databaseService: DatabaseService,
  ) {}

  async detectDuplicatesByHash(
    fileHash: string,
    orgId: string,
  ): Promise<(typeof schema.files.$inferSelect)[]> {
    const db = this.databaseService.getDb();
    return db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.fileHash, fileHash),
          eq(schema.files.orgId, orgId),
          isNull(schema.files.deletedAt),
        ),
      );
  }

  /**
   * Mark duplicate upload attempt
   */
  async markAsDuplicate(
    originalFileId: string,
    orgId: string,
    detectionMethod: 'sha256' | 'content' | 'manual' | 'ai' = 'sha256',
    similarityScore?: number,
    uploadedBy?: string,
  ) {
    const db = this.databaseService.getDb();

    await db.insert(schema.fileDuplicates).values({
      orgId,
      originalFileId,
      detectionMethod,
      similarityScore,
      uploadedBy,
    });

    await this.filesRepository.incrementReferenceCount(originalFileId);

    this.logger.log(
      `Recorded duplicate upload attempt for original file ${originalFileId} (method: ${detectionMethod})`,
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
   * Check if a user has uploaded this file as a duplicate
   * Returns the duplicate record if found
   */
  async getUserDuplicateUpload(fileId: string, userId?: string) {
    if (!userId) {
      return null;
    }

    const db = this.databaseService.getDb();
    const duplicates = await db
      .select()
      .from(schema.fileDuplicates)
      .where(
        and(
          eq(schema.fileDuplicates.originalFileId, fileId),
          eq(schema.fileDuplicates.uploadedBy, userId),
        ),
      )
      .limit(1);

    return duplicates[0] || null;
  }

  /**
   * Remove a duplicate upload record (when user deletes their duplicate upload)
   */
  async removeDuplicateUpload(duplicateId: string) {
    const db = this.databaseService.getDb();
    await db
      .delete(schema.fileDuplicates)
      .where(eq(schema.fileDuplicates.id, duplicateId));
  }

  /**
   * Get the original file if this is a duplicate
   * Note: Since we prevent duplicate file records (unique constraint on fileHash),
   * this method is mainly for future use cases (e.g., content-based duplicate detection)
   */
  async getOriginalFile(fileId: string) {
    // Since we don't create duplicate file records, this would need to check
    // by hash or other means. For now, return null as files are never duplicates.
    return null;
  }

  /**
   * Check if file is a duplicate
   * Note: Since we prevent duplicate file records (unique constraint on fileHash),
   * files are never actually duplicates. This method is for future use cases.
   */
  async isDuplicate(fileId: string): Promise<boolean> {
    // Since we prevent duplicate file records, files are never duplicates
    return false;
  }

  /**
   * Consolidate duplicates - merge all duplicates into original
   * Note: Since we prevent duplicate file records (unique constraint on fileHash),
   * there are no duplicate file records to consolidate.
   * This method is kept for future use cases (e.g., content-based duplicate detection).
   */
  async consolidateDuplicates(originalFileId: string): Promise<number> {
    // Since we prevent duplicate file records, there's nothing to consolidate
    this.logger.log(`No duplicate file records to consolidate for file ${originalFileId}`);
    return 0;
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
    orgId: string,
  ): Promise<{ isDuplicate: boolean; originalFileId?: string }> {
    const duplicates = await this.detectDuplicatesByHash(fileHash, orgId);

    const otherDuplicates = duplicates.filter((f) => f.id !== fileId);

    if (otherDuplicates.length === 0) {
      return { isDuplicate: false };
    }

    const original = otherDuplicates.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )[0];

    const isAlreadyDuplicate = await this.isDuplicate(fileId);
    if (!isAlreadyDuplicate) {
      await this.markAsDuplicate(original.id, orgId, 'sha256');
    }

    return { isDuplicate: true, originalFileId: original.id };
  }
}

