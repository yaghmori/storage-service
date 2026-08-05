import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { and, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';
import { StorageLifecycleEventsService } from '../../lib/platform-kafka';
import { QueuesService } from '../../queues/queues.service';
import { OrgProcessorsService } from './org-processors.service';

const TERMINAL = new Set(['completed', 'failed', 'partial']);

/**
 * Derive files.processing_status from jobs for enabled org processors.
 */
@Injectable()
export class FileProcessingRollupService {
  private readonly logger = new Logger(FileProcessingRollupService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(OrgProcessorsService)
    private readonly orgProcessors: OrgProcessorsService,
    @Optional()
    @Inject(forwardRef(() => QueuesService))
    private readonly queues?: QueuesService,
    @Optional()
    @Inject(StorageLifecycleEventsService)
    private readonly lifecycleEvents?: StorageLifecycleEventsService,
  ) {}

  async refresh(fileId: string, orgId: string) {
    try {
      const enabled = await this.orgProcessors.ensureDefaults(orgId);
      const keys = enabled
        .filter((p) => p.enabled)
        .map((p) => p.processorKey)
        .filter((k) => k !== ProcessorKey.NOTIFY_WEBHOOK);
      if (keys.length === 0) {
        await this.setStatus(fileId, orgId, 'completed', null);
        return;
      }

      const jobs = await this.db
        .select()
        .from(schema.processingJobs)
        .where(
          and(
            eq(schema.processingJobs.fileId, fileId),
            inArray(schema.processingJobs.processorKey, keys),
          ),
        );

      const latest = new Map<string, (typeof jobs)[number]>();
      for (const job of jobs) {
        const prev = latest.get(job.processorKey);
        if (!prev || job.createdAt > prev.createdAt) {
          latest.set(job.processorKey, job);
        }
      }

      if (latest.size === 0) {
        await this.setStatus(fileId, orgId, 'pending', null);
        return;
      }

      const statuses = [...latest.values()].map((j) => j.status);
      const hasFailed = statuses.some((s) => s === 'failed');
      const hasActive = statuses.some(
        (s) => s === 'pending' || s === 'processing',
      );
      const allDone = statuses.every(
        (s) =>
          s === 'completed' ||
          s === 'cancelled' ||
          s === 'skipped' ||
          s === 'failed',
      );
      const allCompleted = statuses.every(
        (s) => s === 'completed' || s === 'skipped' || s === 'cancelled',
      );

      if (hasActive) {
        await this.setStatus(fileId, orgId, 'processing', null);
      } else if (allCompleted) {
        await this.setStatus(fileId, orgId, 'completed', null);
      } else if (hasFailed && allDone) {
        const failed = [...latest.values()].find((j) => j.status === 'failed');
        await this.setStatus(
          fileId,
          orgId,
          statuses.every((s) => s === 'failed') ? 'failed' : 'partial',
          failed?.errorMessage ?? null,
        );
      } else {
        await this.setStatus(fileId, orgId, 'processing', null);
      }
    } catch (error) {
      this.logger.warn(
        `Rollup refresh failed for ${fileId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async setStatus(
    fileId: string,
    orgId: string,
    status:
      | 'pending'
      | 'processing'
      | 'completed'
      | 'failed'
      | 'cancelled'
      | 'partial'
      | 'skipped'
      | null,
    error: string | null,
  ) {
    const [prev] = await this.db
      .select({ processingStatus: schema.files.processingStatus })
      .from(schema.files)
      .where(eq(schema.files.id, fileId))
      .limit(1);

    await this.db
      .update(schema.files)
      .set({
        processingStatus: status,
        processingError: error,
        updatedAt: new Date(),
      })
      .where(eq(schema.files.id, fileId));

    const prevStatus = prev?.processingStatus ?? null;
    if (
      status &&
      TERMINAL.has(status) &&
      !TERMINAL.has(prevStatus ?? '')
    ) {
      void this.lifecycleEvents?.fileProcessed({
        fileId,
        orgId,
        processingStatus: status,
        processingError: error,
      });

      const rows = await this.orgProcessors.ensureDefaults(orgId);
      const webhook = rows.find(
        (r) => r.processorKey === ProcessorKey.NOTIFY_WEBHOOK && r.enabled,
      );
      const webhookSettings = (webhook?.settings ?? {}) as Record<
        string,
        unknown
      >;
      const events = Array.isArray(webhookSettings.events)
        ? webhookSettings.events.filter(
            (value): value is string => typeof value === 'string',
          )
        : [];
      if (
        webhook &&
        this.queues &&
        (events.length === 0 || events.includes(`processing.${status}`))
      ) {
        try {
          await this.queues.enqueueNotifyWebhookJob({
            orgId,
            fileId,
            processingStatus: status,
            processingError: error,
          });
        } catch (err) {
          this.logger.warn(
            `Failed to enqueue notify.webhook: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }
  }
}
