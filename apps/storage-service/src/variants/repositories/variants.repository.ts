import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/schema';

@Injectable()
export class VariantsRepository {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByFileId(fileId: string) {
    return this.db
      .select()
      .from(schema.fileVariants)
      .where(eq(schema.fileVariants.fileId, fileId));
  }

  async findByFileIdAndType(fileId: string, variantType: string) {
    return this.db
      .select()
      .from(schema.fileVariants)
      .where(
        and(
          eq(schema.fileVariants.fileId, fileId),
          eq(schema.fileVariants.variantType, variantType),
        ),
      );
  }

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(schema.fileVariants)
      .where(eq(schema.fileVariants.id, id))
      .limit(1);
    return result[0] || null;
  }

  async create(data: {
    fileId: string;
    variantType: string;
    variantKey: string;
    storageProviderId: number;
    size: bigint;
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  }) {
    const result = await this.db
      .insert(schema.fileVariants)
      .values({
        fileId: data.fileId,
        variantType: data.variantType,
        variantKey: data.variantKey,
        storageProviderId: data.storageProviderId,
        size: data.size,
        width: data.width,
        height: data.height,
        quality: data.quality,
        format: data.format,
      })
      .returning();
    return result[0];
  }

  async delete(id: string) {
    await this.db.delete(schema.fileVariants).where(eq(schema.fileVariants.id, id));
  }

  async deleteByFileId(fileId: string) {
    await this.db
      .delete(schema.fileVariants)
      .where(eq(schema.fileVariants.fileId, fileId));
  }
}

