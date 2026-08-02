import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrganizationService } from '../../organizations/organization.service';
import { OrgRetentionService } from '../../organizations/services/org-retention.service';
import { FileDeletionService } from './file-deletion.service';

@Injectable()
export class RetentionCleanupService {
  private readonly logger = new Logger(RetentionCleanupService.name);
  private running = false;

  constructor(
    private readonly organizations: OrganizationService,
    private readonly retentionService: OrgRetentionService,
    private readonly fileDeletion: FileDeletionService,
  ) {}

  /** Daily soft-delete purge per org retention policy. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDailyCleanup(): Promise<void> {
    if (this.running) {
      this.logger.warn('Retention cleanup already running; skipping');
      return;
    }
    this.running = true;
    try {
      const orgs = await this.organizations.list();
      let total = 0;
      for (const org of orgs) {
        if (org.status !== 'active') continue;
        const retention = await this.retentionService.resolve(org.id);
        const deleted = await this.fileDeletion.cleanupOrphanedFiles(
          retention.softDeleteRetentionDays,
          org.id,
        );
        total += deleted;
      }
      this.logger.log(`Retention cleanup finished; hard-purged ${total} file(s)`);
    } catch (error) {
      this.logger.error(
        `Retention cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
