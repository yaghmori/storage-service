import {
  Controller,
  Get,
  Headers,
  Inject,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { and, count, eq, gte, isNull, lt, lte, sum } from 'drizzle-orm';
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
    const since14d = new Date();
    since14d.setDate(since14d.getDate() - 14);

    const activeFilesWhere = and(
      eq(schema.files.orgId, orgId),
      isNull(schema.files.deletedAt),
    );

    const [
      [fileStats],
      [providersCount],
      jobsByStatus,
      [downloadsLast7d],
      [downloadsPrev7d],
      [filesLast7d],
      [bytesLast7d],
      sparkRows,
    ] = await Promise.all([
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
      this.db
        .select({ count: count() })
        .from(schema.downloadLogs)
        .where(
          and(
            eq(schema.downloadLogs.orgId, orgId),
            gte(schema.downloadLogs.downloadedAt, since14d),
            lt(schema.downloadLogs.downloadedAt, since7d),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(schema.files)
        .where(
          and(
            eq(schema.files.orgId, orgId),
            isNull(schema.files.deletedAt),
            gte(schema.files.createdAt, since7d),
          ),
        ),
      this.db
        .select({ bytes: sum(schema.files.size) })
        .from(schema.files)
        .where(
          and(
            eq(schema.files.orgId, orgId),
            isNull(schema.files.deletedAt),
            gte(schema.files.createdAt, since7d),
          ),
        ),
      this.db
        .select({
          day: schema.downloadLogs.downloadedAt,
        })
        .from(schema.downloadLogs)
        .where(
          and(
            eq(schema.downloadLogs.orgId, orgId),
            gte(schema.downloadLogs.downloadedAt, since7d),
            lte(schema.downloadLogs.downloadedAt, new Date()),
          ),
        )
        .limit(5000),
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

    // Build a simple 7-day sparkline of download counts per day
    const sparkMap = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      sparkMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of sparkRows) {
      const key = new Date(row.day).toISOString().slice(0, 10);
      if (sparkMap.has(key)) {
        sparkMap.set(key, (sparkMap.get(key) ?? 0) + 1);
      }
    }

    return {
      filesCount: Number(fileStats?.filesCount ?? 0),
      totalBytes: Number(fileStats?.totalBytes ?? 0),
      providersCount: Number(providersCount?.count ?? 0),
      jobsByStatus: jobsByStatusMap,
      downloadsLast7d: Number(downloadsLast7d?.count ?? 0),
      downloadsPrev7d: Number(downloadsPrev7d?.count ?? 0),
      filesLast7d: Number(filesLast7d?.count ?? 0),
      bytesLast7d: Number(bytesLast7d?.bytes ?? 0),
      downloadsSparkline: [...sparkMap.entries()].map(([day, count]) => ({
        day,
        count,
      })),
    };
  }
}
