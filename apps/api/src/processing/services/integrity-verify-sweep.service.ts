import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProcessorKey } from '@workspace/validation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';
import { QueuesService } from '../../queues/queues.service';
import { OrgProcessorsService } from './org-processors.service';

const BATCH_PER_ORG = 50;

/**
 * Nightly sweep: enqueue integrity.verify for a batch of files per org
 * that has the processor enabled.
 */
@Injectable()
export class IntegrityVerifySweepService {
  private readonly logger = new Logger(IntegrityVerifySweepService.name);
  private running = false;

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly orgProcessors: OrgProcessorsService,
    private readonly queues: QueuesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async runNightlySweep(): Promise<void> {
    if (this.running) {
      this.logger.warn('Integrity sweep already running; skipping');
      return;
    }
    this.running = true;
    try {
      const orgs = await this.db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.status, 'active'));

      let enqueued = 0;
      for (const org of orgs) {
        const rows = await this.orgProcessors.ensureDefaults(org.id);
        const integrity = rows.find(
          (r) =>
            r.processorKey === ProcessorKey.INTEGRITY_VERIFY && r.enabled,
        );
        if (!integrity) continue;

        const files = await this.db
          .select({ id: schema.files.id })
          .from(schema.files)
          .where(
            and(
              eq(schema.files.orgId, org.id),
              isNull(schema.files.deletedAt),
            ),
          )
          .orderBy(asc(schema.files.updatedAt))
          .limit(BATCH_PER_ORG);

        for (const file of files) {
          await this.queues.enqueueProcessorJob({
            processorKey: ProcessorKey.INTEGRITY_VERIFY,
            orgId: org.id,
            fileId: file.id,
            data: { fileId: file.id, orgId: org.id },
            priority: 8,
          });
          enqueued += 1;
        }
      }
      this.logger.log(`Integrity sweep enqueued ${enqueued} job(s)`);
    } catch (error) {
      this.logger.error(
        `Integrity sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
