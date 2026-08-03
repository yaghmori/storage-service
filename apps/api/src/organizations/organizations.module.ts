import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationService } from './organization.service';
import { OrgLimitsService } from './services/org-limits.service';
import { OrgRetentionService } from './services/org-retention.service';
import { OrgUsageService } from './services/org-usage.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [
    OrganizationService,
    OrgLimitsService,
    OrgRetentionService,
    OrgUsageService,
  ],
  exports: [
    OrganizationService,
    OrgLimitsService,
    OrgRetentionService,
    OrgUsageService,
  ],
})
export class OrganizationsModule {}
