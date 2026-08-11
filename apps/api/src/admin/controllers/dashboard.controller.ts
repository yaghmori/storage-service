import {
  Controller,
  Get,
  Headers,
  Inject,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { and, count, eq, gte, isNull, sum } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IsOptional, IsString } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import * as schema from '../../database/drizzle/schema';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { OrgMembershipGuard } from '../guards/org-membership.guard';
import { requireOrgId } from '../utils/require-org-id';

class OrgQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;
}

@Public()
@Controller({ path: 'admin/api/dashboard', version: VERSION_NEUTRAL })
@UseGuards(AdminAuthGuard, OrgMembershipGuard)
export class DashboardController {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  @Get('stats')
  async getDashboardStats(
    @Query() query: OrgQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    const since7d = new Date();
    since7d.setDate(since7d.getDate() - 7);

    const activeFilesWhere = and(
      eq(schema.files.orgId, orgId),
      isNull(schema.files.deletedAt),
    );

    const [[fileStats], [providersCount], jobsByStatus, [downloadsLast7d]] =
      await Promise.all([
        this.db
          .select({
            filesCount: count(),
            totalBytes: sum(schema.files.size),
          })
          .from(schema.files)
          .where(activeFilesWhere),
        this.db
          .select({ count: count() })
          .from(schema.storageProviders)
          .where(eq(schema.storageProviders.orgId, orgId)),
        this.db
          .select({
            status: schema.processingJobs.status,
            count: count(),
          })
          .from(schema.processingJobs)
          .where(eq(schema.processingJobs.orgId, orgId))
          .groupBy(schema.processingJobs.status),
        this.db
          .select({ count: count() })
          .from(schema.downloadLogs)
          .where(
            and(
              eq(schema.downloadLogs.orgId, orgId),
              gte(schema.downloadLogs.downloadedAt, since7d),
            ),
          ),
      ]);

    const jobsByStatusMap: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const row of jobsByStatus) {
      jobsByStatusMap[row.status] = Number(row.count);
    }

    return {
      filesCount: Number(fileStats?.filesCount ?? 0),
      totalBytes: Number(fileStats?.totalBytes ?? 0),
      providersCount: Number(providersCount?.count ?? 0),
      jobsByStatus: jobsByStatusMap,
      downloadsLast7d: Number(downloadsLast7d?.count ?? 0),
    };
  }
}
