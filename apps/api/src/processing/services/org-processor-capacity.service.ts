import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, eq, gte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DelayedError, Job } from 'bullmq';
import * as schema from '../../database/drizzle/schema';
import { OrgProcessorsService } from './org-processors.service';

const DELAY_MS = 5_000;

/**
 * Enforces per-org processor concurrency / rate from org_processors.settings.
 * Platform BullMQ worker.concurrency remains a hard ceiling only.
 */
@Injectable()
export class OrgProcessorCapacityService {
  private readonly logger = new Logger(OrgProcessorCapacityService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly orgProcessors: OrgProcessorsService,
  ) {}

  /**
   * If the org is over capacity, delay the BullMQ job and throw DelayedError
   * so the worker does not mark the job failed.
   */
  async assertOrDelay(
    job: Job<{ orgId?: string; fileId: string | number }>,
    processorKey: string,
  ): Promise<void> {
    const orgId = job.data.orgId;
    if (!orgId) return;

    const capacity = await this.orgProcessors.getCapacity(orgId, processorKey);

    const [[inflight]] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(schema.processingJobs)
        .where(
          and(
            eq(schema.processingJobs.orgId, orgId),
            eq(schema.processingJobs.processorKey, processorKey),
            eq(schema.processingJobs.status, 'processing'),
          ),
        ),
    ]);

    const active = Number(inflight?.count ?? 0);
    if (active >= capacity.concurrency) {
      this.logger.debug(
        `Org ${orgId} ${processorKey} at concurrency ${active}/${capacity.concurrency}; delaying`,
      );
      await job.moveToDelayed(Date.now() + DELAY_MS, job.token);
      throw new DelayedError();
    }

    if (capacity.rateMax && capacity.rateDurationMs) {
      const since = new Date(Date.now() - capacity.rateDurationMs);
      const [recent] = await this.db
        .select({ count: count() })
        .from(schema.processingJobs)
        .where(
          and(
            eq(schema.processingJobs.orgId, orgId),
            eq(schema.processingJobs.processorKey, processorKey),
            gte(schema.processingJobs.startedAt, since),
          ),
        );
      const started = Number(recent?.count ?? 0);
      if (started >= capacity.rateMax) {
        this.logger.debug(
          `Org ${orgId} ${processorKey} rate ${started}/${capacity.rateMax} per ${capacity.rateDurationMs}ms; delaying`,
        );
        await job.moveToDelayed(Date.now() + DELAY_MS, job.token);
        throw new DelayedError();
      }
    }
  }
}
