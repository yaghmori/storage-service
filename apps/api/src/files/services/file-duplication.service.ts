import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
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
   * Soft near-dupe flag for admin review. Does NOT bump reference_count / skip storage.
   */
  async flagContentNearDuplicate(input: {
    originalFileId: string;
    duplicateFileId: string;
    orgId: string;
    similarityScore: number;
    uploadedBy?: string;
  }) {
    const db = this.databaseService.getDb();
    const existing = await db
      .select({ id: schema.fileDuplicates.id })
      .from(schema.fileDuplicates)
      .where(
        and(
          eq(schema.fileDuplicates.orgId, input.orgId),
          eq(schema.fileDuplicates.detectionMethod, 'content'),
          or(
            and(
              eq(schema.fileDuplicates.originalFileId, input.originalFileId),
              eq(schema.fileDuplicates.duplicateFileId, input.duplicateFileId),
            ),
            and(
              eq(schema.fileDuplicates.originalFileId, input.duplicateFileId),
              eq(schema.fileDuplicates.duplicateFileId, input.originalFileId),
            ),
          ),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(schema.fileDuplicates)
        .set({ similarityScore: input.similarityScore })
        .where(eq(schema.fileDuplicates.id, existing[0].id));
      return existing[0];
    }

    const [row] = await db
      .insert(schema.fileDuplicates)
      .values({
        orgId: input.orgId,
        originalFileId: input.originalFileId,
        duplicateFileId: input.duplicateFileId,
        detectionMethod: 'content',
        similarityScore: input.similarityScore,
        uploadedBy: input.uploadedBy,
        isConfirmed: false,
      })
      .returning();
    this.logger.log(
      `Flagged near-duplicate ${input.duplicateFileId} of ${input.originalFileId} (score=${input.similarityScore})`,
    );
    return row;
  }

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

  /** Near-dupe / SHA flags involving this file (as original or related). */
  async listForFile(fileId: string, orgId: string) {
    const db = this.databaseService.getDb();

    const rows = await db
      .select()
      .from(schema.fileDuplicates)
      .where(
        and(
          eq(schema.fileDuplicates.orgId, orgId),
          or(
            eq(schema.fileDuplicates.originalFileId, fileId),
            eq(schema.fileDuplicates.duplicateFileId, fileId),
          ),
        ),
      )
      .orderBy(desc(schema.fileDuplicates.detectedAt));

    const relatedIds = [
      ...new Set(
        rows
          .map((row) =>
            row.originalFileId === fileId
              ? row.duplicateFileId
              : row.originalFileId,
          )
          .filter((id): id is string => !!id),
      ),
    ];

    const relatedFiles =
      relatedIds.length === 0
        ? []
        : await db
            .select({
              id: schema.files.id,
              originalFileName: schema.files.originalFileName,
              mimeType: schema.files.mimeType,
              size: schema.files.size,
              width: schema.files.width,
              height: schema.files.height,
              createdAt: schema.files.createdAt,
              deletedAt: schema.files.deletedAt,
              fileHash: schema.files.fileHash,
              processingStatus: schema.files.processingStatus,
              storageKey: schema.files.storageKey,
            })
            .from(schema.files)
            .where(inArray(schema.files.id, relatedIds));

    const byId = new Map(relatedFiles.map((f) => [f.id, f]));

    return rows.map((row) => {
      const relatedId =
        row.originalFileId === fileId
          ? row.duplicateFileId
          : row.originalFileId;
      const related = relatedId ? byId.get(relatedId) : undefined;
      return {
        id: row.id,
        orgId: row.orgId,
        originalFileId: row.originalFileId,
        duplicateFileId: row.duplicateFileId,
        relatedFileId: relatedId ?? null,
        relatedFileName: related?.originalFileName ?? null,
        relatedMimeType: related?.mimeType ?? null,
        relatedSize: related?.size != null ? Number(related.size) : null,
        relatedWidth: related?.width ?? null,
        relatedHeight: related?.height ?? null,
        relatedCreatedAt: related?.createdAt ?? null,
        relatedDeletedAt: related?.deletedAt ?? null,
        relatedFileHash: related?.fileHash ?? null,
        relatedProcessingStatus: related?.processingStatus ?? null,
        relatedStorageKey: related?.storageKey ?? null,
        detectionMethod: row.detectionMethod,
        similarityScore: row.similarityScore,
        isConfirmed: row.isConfirmed,
        confirmedBy: row.confirmedBy,
        confirmedAt: row.confirmedAt,
        detectedAt: row.detectedAt,
      };
    });
  }

  async confirmDuplicate(
    duplicateId: string,
    orgId: string,
    fileId: string,
    confirmedBy?: string,
  ) {
    const db = this.databaseService.getDb();
    const confirmedById =
      confirmedBy &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        confirmedBy,
      )
        ? confirmedBy
        : null;
    const [row] = await db
      .update(schema.fileDuplicates)
      .set({
        isConfirmed: true,
        confirmedBy: confirmedById,
        confirmedAt: new Date(),
      })
      .where(
        and(
          eq(schema.fileDuplicates.id, duplicateId),
          eq(schema.fileDuplicates.orgId, orgId),
          or(
            eq(schema.fileDuplicates.originalFileId, fileId),
            eq(schema.fileDuplicates.duplicateFileId, fileId),
          ),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException('Duplicate record not found');
    return row;
  }

  async dismissDuplicate(
    duplicateId: string,
    orgId: string,
    fileId: string,
  ) {
    const db = this.databaseService.getDb();
    const [row] = await db
      .delete(schema.fileDuplicates)
      .where(
        and(
          eq(schema.fileDuplicates.id, duplicateId),
          eq(schema.fileDuplicates.orgId, orgId),
          or(
            eq(schema.fileDuplicates.originalFileId, fileId),
            eq(schema.fileDuplicates.duplicateFileId, fileId),
          ),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException('Duplicate record not found');
    return row;
  }

  async getDuplicates(fileId: string) {
    const db = this.databaseService.getDb();
    return db
      .select()
      .from(schema.fileDuplicates)
      .where(eq(schema.fileDuplicates.originalFileId, fileId));
  }

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

  async removeDuplicateUpload(duplicateId: string) {
    const db = this.databaseService.getDb();
    await db
      .delete(schema.fileDuplicates)
      .where(eq(schema.fileDuplicates.id, duplicateId));
  }

  async getOriginalFile(_fileId: string) {
    return null;
  }

  async isDuplicate(_fileId: string): Promise<boolean> {
    return false;
  }

  async consolidateDuplicates(originalFileId: string): Promise<number> {
    this.logger.log(
      `No duplicate file records to consolidate for file ${originalFileId}`,
    );
    return 0;
  }

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

    await this.markAsDuplicate(original.id, orgId, 'sha256');

    return { isDuplicate: true, originalFileId: original.id };
  }
}
