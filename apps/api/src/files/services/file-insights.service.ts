import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { toJsonSafe } from '../../common/utils/json-safe.util';
import * as schema from '../../database/drizzle/schema';
import { VariantsService } from '../../variants/services/variants.service';
import { FilesService } from './files.service';

/**
 * Consumer-facing file insights (API key). Exposes processor outputs that
 * used to be admin-only so SDKs (eallyfe, legacy) can poll OCR/EXIF/AI results.
 */
@Injectable()
export class FileInsightsService {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
  ) {}

  private async requireFile(fileId: string, orgId: string) {
    const file = await this.filesService.findById(fileId, orgId);
    if (!file) {
      throw new NotFoundException(`File with id ${fileId} not found`);
    }
    return file;
  }

  async listProcessorResults(fileId: string, orgId: string) {
    await this.requireFile(fileId, orgId);
    const rows = await this.db
      .select({
        id: schema.fileProcessorResults.id,
        fileId: schema.fileProcessorResults.fileId,
        processorKey: schema.fileProcessorResults.processorKey,
        status: schema.fileProcessorResults.status,
        schemaVersion: schema.fileProcessorResults.schemaVersion,
        backendId: schema.fileProcessorResults.backendId,
        backendKind: schema.fileProcessorResults.backendKind,
        model: schema.fileProcessorResults.model,
        data: schema.fileProcessorResults.data,
        error: schema.fileProcessorResults.error,
        processedAt: schema.fileProcessorResults.processedAt,
        createdAt: schema.fileProcessorResults.createdAt,
        updatedAt: schema.fileProcessorResults.updatedAt,
      })
      .from(schema.fileProcessorResults)
      .where(
        and(
          eq(schema.fileProcessorResults.fileId, fileId),
          eq(schema.fileProcessorResults.orgId, orgId),
        ),
      )
      .orderBy(desc(schema.fileProcessorResults.updatedAt));

    return {
      items: rows.map((row) => toJsonSafe(row)),
      total: rows.length,
    };
  }

  async getProcessorResult(
    fileId: string,
    orgId: string,
    processorKey: string,
  ) {
    await this.requireFile(fileId, orgId);
    const [row] = await this.db
      .select({
        id: schema.fileProcessorResults.id,
        fileId: schema.fileProcessorResults.fileId,
        processorKey: schema.fileProcessorResults.processorKey,
        status: schema.fileProcessorResults.status,
        schemaVersion: schema.fileProcessorResults.schemaVersion,
        backendId: schema.fileProcessorResults.backendId,
        backendKind: schema.fileProcessorResults.backendKind,
        model: schema.fileProcessorResults.model,
        data: schema.fileProcessorResults.data,
        error: schema.fileProcessorResults.error,
        processedAt: schema.fileProcessorResults.processedAt,
        createdAt: schema.fileProcessorResults.createdAt,
        updatedAt: schema.fileProcessorResults.updatedAt,
      })
      .from(schema.fileProcessorResults)
      .where(
        and(
          eq(schema.fileProcessorResults.fileId, fileId),
          eq(schema.fileProcessorResults.orgId, orgId),
          eq(schema.fileProcessorResults.processorKey, processorKey),
        ),
      )
      .limit(1);

    if (!row) {
      return {
        fileId,
        processorKey,
        status: null,
        data: null,
        error: null,
        model: null,
        processedAt: null,
      };
    }
    return toJsonSafe(row);
  }

  async getMetadata(fileId: string, orgId: string) {
    await this.requireFile(fileId, orgId);
    const [row] = await this.db
      .select({
        fileId: schema.fileProcessorResults.fileId,
        metadata: schema.fileProcessorResults.data,
        extractedAt: schema.fileProcessorResults.processedAt,
        updatedAt: schema.fileProcessorResults.updatedAt,
        status: schema.fileProcessorResults.status,
      })
      .from(schema.fileProcessorResults)
      .where(
        and(
          eq(schema.fileProcessorResults.fileId, fileId),
          eq(schema.fileProcessorResults.orgId, orgId),
          eq(
            schema.fileProcessorResults.processorKey,
            ProcessorKey.METADATA_EXIF,
          ),
        ),
      )
      .limit(1);

    if (!row) {
      return {
        fileId,
        metadata: null,
        extractedAt: null,
        updatedAt: null,
        status: null,
      };
    }
    return toJsonSafe(row);
  }

  async listVariants(fileId: string, orgId: string) {
    await this.requireFile(fileId, orgId);
    const variants = await this.variantsService.findByFileId(fileId);
    return { items: variants, total: variants.length };
  }
}
