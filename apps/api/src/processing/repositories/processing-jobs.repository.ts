import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';
import type { JobLogEntry } from '../../database/drizzle/schema';

export type ProcessingJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'partial'
  | 'skipped';

const MAX_LOG_ENTRIES = 200;

/**
 * A cancelled job must stay cancelled: a worker that was already running (or
 * that picked the job up before it could be removed from Redis) must not push
 * the row back to processing/completed/failed. Re-queueing (retry/rerun) sets
 * the row back to `pending` through its own reset and is allowed.
 */
function notCancelledUnless(status: ProcessingJobStatus) {
  if (status === 'cancelled' || status === 'pending') return undefined;
  return ne(schema.processingJobs.status, 'cancelled');
}

@Injectable()
export class ProcessingJobsRepository {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: {
    fileId: string;
    orgId?: string;
    processorKey: string;
    status?: ProcessingJobStatus;
    bullmqJobId?: string;
    backendId?: string | null;
    parameters?: Record<string, unknown>;
    priority?: number;
  }) {
    let orgId = data.orgId;
    if (!orgId) {
      const [file] = await this.db
        .select({ orgId: schema.files.orgId })
        .from(schema.files)
        .where(eq(schema.files.id, data.fileId))
        .limit(1);
      orgId = file?.orgId || process.env.AUTH_DEFAULT_ORG_ID;
    }
    if (!orgId) {
      throw new Error(`Cannot create processing job: orgId missing for file ${data.fileId}`);
    }

    const result = await this.db
      .insert(schema.processingJobs)
      .values({
        orgId,
        fileId: data.fileId,
        processorKey: data.processorKey,
        status: data.status || 'pending',
        bullmqJobId: data.bullmqJobId,
        backendId: data.backendId ?? null,
        parameters: data.parameters ?? {},
        priority: data.priority ?? 0,
        logs: [],
      })
      .returning();
    return result[0];
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(schema.processingJobs)
      .where(eq(schema.processingJobs.id, id))
      .limit(1);
    return row ?? null;
  }

  async setBullmqJobId(id: string, bullmqJobId: string) {
    const result = await this.db
      .update(schema.processingJobs)
      .set({ bullmqJobId })
      .where(eq(schema.processingJobs.id, id))
      .returning();
    return result[0] || null;
  }

  async updateStatus(
    id: string,
    status: ProcessingJobStatus,
    errorMessage?: string | null,
  ) {
    const result = await this.db
      .update(schema.processingJobs)
      .set(this.statusPatch(status, errorMessage))
      .where(and(eq(schema.processingJobs.id, id), notCancelledUnless(status)))
      .returning();
    if (result[0]) return result[0];
    // Admin cancelled the job while it was in flight; keep the cancellation.
    return (await this.findById(id)) ?? undefined;
  }

  async incrementRetry(id: string) {
    const existing = await this.findById(id);
    if (!existing) return null;
    const [row] = await this.db
      .update(schema.processingJobs)
      .set({
        retryCount: (existing.retryCount ?? 0) + 1,
        status: 'pending',
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        logs: [],
        output: null,
        progress: null,
      })
      .where(eq(schema.processingJobs.id, id))
      .returning();
    return row ?? null;
  }

  async findByFileId(fileId: string) {
    return this.db
      .select()
      .from(schema.processingJobs)
      .where(eq(schema.processingJobs.fileId, fileId));
  }

  async findByBullmqJobId(bullmqJobId: string) {
    const result = await this.db
      .select()
      .from(schema.processingJobs)
      .where(eq(schema.processingJobs.bullmqJobId, bullmqJobId))
      .limit(1);
    return result[0] || null;
  }

  async updateStatusByBullmqJobId(
    bullmqJobId: string,
    status: ProcessingJobStatus,
    errorMessage?: string | null,
  ) {
    const result = await this.db
      .update(schema.processingJobs)
      .set(this.statusPatch(status, errorMessage))
      .where(
        and(
          eq(schema.processingJobs.bullmqJobId, bullmqJobId),
          notCancelledUnless(status),
        ),
      )
      .returning();
    if (result[0]) return result[0];
    return await this.findByBullmqJobId(bullmqJobId);
  }

  private statusPatch(
    status: ProcessingJobStatus,
    errorMessage?: string | null,
  ) {
    const clearError =
      status === 'pending' ||
      status === 'processing' ||
      status === 'completed' ||
      status === 'cancelled';
    return {
      status,
      errorMessage: clearError
        ? errorMessage === undefined
          ? null
          : errorMessage
        : (errorMessage ?? null),
      completedAt:
        status === 'completed' || status === 'failed' || status === 'skipped'
          ? new Date()
          : null,
      startedAt: status === 'processing' ? new Date() : undefined,
    };
  }

  async appendLog(
    id: string,
    level: JobLogEntry['level'],
    message: string,
  ) {
    const entry: JobLogEntry = {
      ts: new Date().toISOString(),
      level,
      message: message.slice(0, 4000),
    };
    const [row] = await this.db
      .update(schema.processingJobs)
      .set({
        logs: sql`COALESCE(${schema.processingJobs.logs}, '[]'::jsonb) || ${JSON.stringify([entry])}::jsonb`,
      })
      .where(eq(schema.processingJobs.id, id))
      .returning({
        id: schema.processingJobs.id,
        logs: schema.processingJobs.logs,
      });

    if (row?.logs && Array.isArray(row.logs) && row.logs.length > MAX_LOG_ENTRIES) {
      await this.db
        .update(schema.processingJobs)
        .set({
          logs: row.logs.slice(-MAX_LOG_ENTRIES),
        })
        .where(eq(schema.processingJobs.id, id));
    }

    return row ?? null;
  }

  async setOutput(id: string, output: Record<string, unknown> | null) {
    const [row] = await this.db
      .update(schema.processingJobs)
      .set({ output })
      .where(eq(schema.processingJobs.id, id))
      .returning();
    return row ?? null;
  }

  async resetForRetry(id: string, retryCount: number) {
    const [row] = await this.db
      .update(schema.processingJobs)
      .set({
        status: 'pending',
        errorMessage: null,
        progress: null,
        startedAt: null,
        completedAt: null,
        retryCount,
        bullmqJobId: null,
        logs: [],
        output: null,
      })
      .where(eq(schema.processingJobs.id, id))
      .returning();
    return row ?? null;
  }
}
