import {
  Controller,
  Get,
  Headers,
  Inject,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { and, count, desc, eq, gte, sql, sum } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../../common/decorators/public.decorator';
import * as schema from '../../database/drizzle/schema';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { OrgMembershipGuard } from '../guards/org-membership.guard';
import { requireOrgId } from '../utils/require-org-id';

class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Public()
@Controller({ path: 'admin/api/analytics', version: VERSION_NEUTRAL })
@UseGuards(AdminAuthGuard, OrgMembershipGuard)
export class AnalyticsController {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  @Get('summary')
  async getSummary(
    @Query() query: AnalyticsQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    const since = new Date();
    since.setDate(since.getDate() - 14);
    since.setHours(0, 0, 0, 0);

    const orgFilter = eq(schema.downloadLogs.orgId, orgId);

    const [totals] = await this.db
      .select({
        totalDownloads: count(),
        bytesDownloaded: sum(schema.downloadLogs.bytesDownloaded),
      })
      .from(schema.downloadLogs)
      .where(orgFilter);

    const downloadsByDay = await this.db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${schema.downloadLogs.downloadedAt}), 'YYYY-MM-DD')`,
        downloads: count(),
        bytes: sum(schema.downloadLogs.bytesDownloaded),
      })
      .from(schema.downloadLogs)
      .where(and(orgFilter, gte(schema.downloadLogs.downloadedAt, since)))
      .groupBy(sql`date_trunc('day', ${schema.downloadLogs.downloadedAt})`)
      .orderBy(sql`date_trunc('day', ${schema.downloadLogs.downloadedAt})`);

    return {
      totalDownloads: Number(totals?.totalDownloads ?? 0),
      bytesDownloaded: Number(totals?.bytesDownloaded ?? 0),
      downloadsByDay: downloadsByDay.map((row) => ({
        day: row.day,
        downloads: Number(row.downloads),
        bytes: Number(row.bytes ?? 0),
      })),
    };
  }

  @Get('downloads')
  async listDownloads(
    @Query() query: AnalyticsQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const where = eq(schema.downloadLogs.orgId, orgId);

    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(schema.downloadLogs)
        .where(where)
        .orderBy(desc(schema.downloadLogs.downloadedAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(schema.downloadLogs).where(where),
    ]);

    return {
      items: rows,
      total: Number(totalResult[0]?.total ?? 0),
      page,
      limit,
    };
  }
}
