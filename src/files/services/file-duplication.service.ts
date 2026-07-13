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
   * Mark duplicate upload attempt
   * Records when a user attempts to upload a file that already exists
   *
   * @param originalFileId - File ID of the original file
   * @param detectionMethod - Method used to detect the duplicate
   * @param similarityScore - Optional similarity score for content-based detection
   * @param uploadedBy - Optional user ID (UUID) who uploaded
   */
  async markAsDuplicate(
    originalFileId: string,
    detectionMethod: 'sha256' | 'content' | 'manual' | 'ai' = 'sha256',
    similarityScore?: number,
    uploadedBy?: string,
  ) {
    const db = this.databaseService.getDb();

    // Create duplicate upload attempt record
    await db.insert(schema.fileDuplicates).values({
      originalFileId,
      detectionMethod,
      similarityScore,
      uploadedBy,
    });

    // Increment reference count of original
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
    // Note: This method is for future use cases where we might allow duplicate file records
    // For now, we prevent duplicates via unique constraint, so this won't be called
    const isAlreadyDuplicate = await this.isDuplicate(fileId);
    if (!isAlreadyDuplicate) {
      await this.markAsDuplicate(original.id, 'sha256');
    }

    return { isDuplicate: true, originalFileId: original.id };
  }
}

