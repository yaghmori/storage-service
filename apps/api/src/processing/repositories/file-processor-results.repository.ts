import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';

export type ProcessorResultStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'partial'
  | 'skipped';

@Injectable()
export class FileProcessorResultsRepository {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByFileId(fileId: string) {
    return this.db
      .select()
      .from(schema.fileProcessorResults)
      .where(eq(schema.fileProcessorResults.fileId, fileId));
  }

  async findByFileAndProcessor(fileId: string, processorKey: string) {
    const [row] = await this.db
      .select()
      .from(schema.fileProcessorResults)
      .where(
        and(
          eq(schema.fileProcessorResults.fileId, fileId),
          eq(schema.fileProcessorResults.processorKey, processorKey),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsert(input: {
    orgId: string;
    fileId: string;
    processorKey: string;
    status: ProcessorResultStatus;
    schemaVersion?: number;
    backendId?: string | null;
    backendKind?: string | null;
    model?: string | null;
    data?: Record<string, unknown>;
    error?: string | null;
    jobId?: string | null;
    processedAt?: Date | null;
  }) {
    const now = new Date();
    const [row] = await this.db
      .insert(schema.fileProcessorResults)
      .values({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: input.processorKey,
        status: input.status,
        schemaVersion: input.schemaVersion ?? 1,
        backendId: input.backendId ?? null,
        backendKind: input.backendKind ?? null,
        model: input.model ?? null,
        data: input.data ?? {},
        error: input.error ?? null,
        jobId: input.jobId ?? null,
        processedAt: input.processedAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.fileProcessorResults.fileId,
          schema.fileProcessorResults.processorKey,
        ],
        set: {
          status: input.status,
          schemaVersion: input.schemaVersion ?? 1,
          backendId: input.backendId ?? null,
          backendKind: input.backendKind ?? null,
          model: input.model ?? null,
          data: input.data ?? {},
          error: input.error ?? null,
          jobId: input.jobId ?? null,
          processedAt: input.processedAt ?? null,
          updatedAt: now,
        },
      })
      .returning();
    return row;
  }

  async markStatus(
    fileId: string,
    processorKey: string,
    status: ProcessorResultStatus,
    error?: string | null,
  ) {
    const [row] = await this.db
      .update(schema.fileProcessorResults)
      .set({
        status,
        error: error ?? null,
        updatedAt: new Date(),
        processedAt:
          status === 'completed' || status === 'failed' || status === 'skipped'
            ? new Date()
            : undefined,
      })
      .where(
        and(
          eq(schema.fileProcessorResults.fileId, fileId),
          eq(schema.fileProcessorResults.processorKey, processorKey),
        ),
      )
      .returning();
    return row ?? null;
  }
}
