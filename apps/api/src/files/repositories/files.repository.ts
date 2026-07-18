import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';

@Injectable()
export class FilesRepository {
  private readonly logger = new Logger(FilesRepository.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string, orgId?: string) {
    try {
      const conditions = [eq(schema.files.id, id)];
      if (orgId) conditions.push(eq(schema.files.orgId, orgId));
      const result = await this.db
        .select()
        .from(schema.files)
        .where(and(...conditions))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      this.logger.error(`Error finding file by ID ${id}:`, error);
      throw error;
    }
  }

  async findByHash(fileHash: string, orgId: string) {
    try {
      return await this.db
        .select()
        .from(schema.files)
        .where(
          and(eq(schema.files.fileHash, fileHash), eq(schema.files.orgId, orgId)),
        );
    } catch (error) {
      this.logger.error(`Error finding file by hash ${fileHash}:`, error);
      if (error instanceof Error && error.message.includes('does not exist')) {
        throw new Error(
          `Database table 'files' does not exist. Please run migrations: pnpm db:migrate`,
        );
      }
      throw error;
    }
  }

  async findByKeyAndProvider(storageKey: string, storageProviderId: string) {
    const result = await this.db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.storageKey, storageKey),
          eq(schema.files.storageProviderId, storageProviderId),
        ),
      )
      .limit(1);
    return result[0] || null;
  }

  async create(data: {
    orgId: string;
    storageProviderId: string;
    storageKey: string;
    storageBucket?: string;
    fileName: string;
    originalFileName: string;
    fileExtension?: string;
    mimeType: string;
    size: bigint;
    fileHash: string;
    checksum?: string;
    uploadedBy?: string;
    tags?: string;
    referenceCount?: number;
  }) {
    const result = await this.db
      .insert(schema.files)
      .values({
        orgId: data.orgId,
        storageProviderId: data.storageProviderId,
        storageKey: data.storageKey,
        storageBucket: data.storageBucket,
        fileName: data.fileName,
        originalFileName: data.originalFileName,
        fileExtension: data.fileExtension,
        mimeType: data.mimeType,
        size: data.size,
        fileHash: data.fileHash,
        checksum: data.checksum,
        uploadedBy: data.uploadedBy,
        tags: data.tags,
        referenceCount: data.referenceCount || 1,
      })
      .returning();
    return result[0];
  }

  async incrementReferenceCount(id: string) {
    const file = await this.findById(id);
    if (file) {
      const result = await this.db
        .update(schema.files)
        .set({
          referenceCount: file.referenceCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.files.id, id))
        .returning();
      return result[0];
    }
    return null;
  }

  async decrementReferenceCount(id: string) {
    const file = await this.findById(id);
    if (file && file.referenceCount > 0) {
      const result = await this.db
        .update(schema.files)
        .set({
          referenceCount: file.referenceCount - 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.files.id, id))
        .returning();
      return result[0];
    }
    return null;
  }

  async delete(id: string) {
    await this.db.delete(schema.files).where(eq(schema.files.id, id));
  }

  async softDelete(id: string) {
    const result = await this.db
      .update(schema.files)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.files.id, id))
      .returning();
    return result[0] || null;
  }

  async restore(id: string) {
    const result = await this.db
      .update(schema.files)
      .set({
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.files.id, id))
      .returning();
    return result[0] || null;
  }

  async markAsOrphaned(id: string) {
    const result = await this.db
      .update(schema.files)
      .set({
        isOrphaned: true,
        orphanedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.files.id, id))
      .returning();
    return result[0] || null;
  }

  async findActive() {
    return this.db
      .select()
      .from(schema.files)
      .where(isNull(schema.files.deletedAt));
  }

  async findDeleted() {
    return this.db
      .select()
      .from(schema.files)
      .where(sql`${schema.files.deletedAt} IS NOT NULL`);
  }

  async update(id: string, data: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    isProcessed?: boolean;
    processingStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    [key: string]: unknown;
  }) {
    // Build update object with only defined fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Only include defined fields
    if (data.width !== undefined) updateData.width = data.width;
    if (data.height !== undefined) updateData.height = data.height;
    if (data.aspectRatio !== undefined) updateData.aspectRatio = data.aspectRatio;
    if (data.isProcessed !== undefined) updateData.isProcessed = data.isProcessed;
    if (data.processingStatus !== undefined) updateData.processingStatus = data.processingStatus;

    // Include any other fields from data
    Object.keys(data).forEach((key) => {
      if (!['width', 'height', 'aspectRatio', 'isProcessed', 'processingStatus'].includes(key)) {
        updateData[key] = data[key];
      }
    });

    const result = await this.db
      .update(schema.files)
      .set(updateData)
      .where(eq(schema.files.id, id))
      .returning();
    return result[0] || null;
  }
}

