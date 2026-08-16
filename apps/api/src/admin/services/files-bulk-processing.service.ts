import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, count, gt, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';
import { ProcessorSchedulerService } from '../../processing/services/processor-scheduler.service';
import {
  buildFileListConditions,
  type FileListFilters,
} from '../utils/file-list-filters';

const BATCH_SIZE = 200;
/** Files scheduled in parallel within a batch. The worker gate enforces real per-org limits. */
const SCHEDULE_CONCURRENCY = 5;
/** Hard ceiling so a stray click cannot enqueue unbounded work. */
export const MAX_SWEEP_FILES = 200_000;

export type SweepProgress = {
  running: boolean;
  matched: number;
  processed: number;
  /** Files for which at least one processor job was enqueued. */
  scheduled: number;
  failed: number;
  cancelRequested: boolean;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

type SweepState = SweepProgress & { orgId: string };

/**
 * Schedules processing for every file matching the Files-table filters, not just
 * the loaded page. Runs detached from the request so large backfills (e.g. after
 * a storage migration) do not hold an HTTP connection open, and exposes progress
 * plus cancellation.
 *
 * Progress is tracked in memory, so status reflects the API replica that started
 * the sweep. One sweep per org at a time.
 */
@Injectable()
export class FilesBulkProcessingService {
  private readonly logger = new Logger(FilesBulkProcessingService.name);
  private readonly sweeps = new Map<string, SweepState>();

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly scheduler: ProcessorSchedulerService,
  ) {}

  getProgress(orgId: string): SweepProgress | null {
    const state = this.sweeps.get(orgId);
    if (!state) return null;
    const { orgId: _orgId, ...progress } = state;
    return progress;
  }

  requestCancel(orgId: string): boolean {
    const state = this.sweeps.get(orgId);
    if (!state?.running) {
      return false;
    }
    state.cancelRequested = true;
    return true;
  }

  async start(
    orgId: string,
    filters: FileListFilters,
    limit?: number,
  ): Promise<{ matched: number; progress: SweepProgress }> {
    const existing = this.sweeps.get(orgId);
    if (existing?.running) {
      throw new ConflictException(
        'A bulk processing run is already in progress for this organization',
      );
    }

    // Soft-deleted files have no reason to be reprocessed.
    const effectiveFilters: FileListFilters = {
      ...filters,
      includeDeleted: false,
      deletedOnly: false,
    };
    const conditions = buildFileListConditions(orgId, effectiveFilters);
    const where = and(...conditions);

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(schema.files)
      .where(where);

    const cap = Math.min(
      MAX_SWEEP_FILES,
      limit && limit > 0 ? limit : MAX_SWEEP_FILES,
    );
    const matched = Math.min(Number(totalRow?.total ?? 0), cap);

    const state: SweepState = {
      orgId,
      running: matched > 0,
      matched,
      processed: 0,
      scheduled: 0,
      failed: 0,
      cancelRequested: false,
      startedAt: new Date().toISOString(),
      finishedAt: matched > 0 ? null : new Date().toISOString(),
      error: null,
    };
    this.sweeps.set(orgId, state);

    if (matched > 0) {
      void this.run(state, conditions, matched);
    }

    return { matched, progress: this.getProgress(orgId)! };
  }

  private async run(state: SweepState, conditions: SQL[], cap: number) {
    let lastId: string | null = null;

    try {
      while (state.processed < cap && !state.cancelRequested) {
        const pageConditions = lastId
          ? [...conditions, gt(schema.files.id, lastId)]
          : conditions;

        const remaining = cap - state.processed;
        const rows: {
          id: string;
          mimeType: string;
          originalFileName: string | null;
        }[] = await this.db
          .select({
            id: schema.files.id,
            mimeType: schema.files.mimeType,
            originalFileName: schema.files.originalFileName,
          })
          .from(schema.files)
          .where(and(...pageConditions))
          // Keyset on the primary key: stable and index-backed across batches.
          .orderBy(asc(schema.files.id))
          .limit(Math.min(BATCH_SIZE, remaining));

        if (rows.length === 0) {
          break;
        }
        lastId = rows[rows.length - 1]!.id;

        let cursor = 0;
        const workers = Array.from(
          { length: Math.min(SCHEDULE_CONCURRENCY, rows.length) },
          async () => {
            while (cursor < rows.length && !state.cancelRequested) {
              const row = rows[cursor++]!;
              try {
                const result = await this.scheduler.scheduleForFile({
                  fileId: row.id,
                  orgId: state.orgId,
                  mimeType: row.mimeType,
                  originalFileName: row.originalFileName ?? undefined,
                });
                if (result.scheduled.length > 0) {
                  state.scheduled += 1;
                }
              } catch (error) {
                state.failed += 1;
                this.logger.warn(
                  `Bulk processing: failed to schedule file ${row.id}: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
              }
              state.processed += 1;
            }
          },
        );
        await Promise.all(workers);
      }

      this.logger.log(
        `Bulk processing finished for org ${state.orgId}: processed=${state.processed} scheduled=${state.scheduled} failed=${state.failed}${
          state.cancelRequested ? ' (cancelled)' : ''
        }`,
      );
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Bulk processing sweep failed for org ${state.orgId}: ${state.error}`,
      );
    } finally {
      state.running = false;
      state.finishedAt = new Date().toISOString();
    }
  }
}
