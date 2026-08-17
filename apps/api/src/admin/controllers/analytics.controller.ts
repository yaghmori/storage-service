import {
  Controller,
  Get,
  Headers,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { OrgMembershipGuard } from '../guards/org-membership.guard';
import { MetricsService } from '../services/metrics.service';
import { requireOrgId } from '../utils/require-org-id';

function toStringArray(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

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

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  country?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  method?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  device?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBytes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxBytes?: number;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(['requests', 'bytes'])
  metric?: 'requests' | 'bytes';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

@Public()
@Controller({ path: 'admin/api/analytics', version: VERSION_NEUTRAL })
@UseGuards(AdminAuthGuard, OrgMembershipGuard)
export class AnalyticsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('summary')
  async getSummary(
    @Query() query: AnalyticsQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    return this.metrics.getSummary(orgId, query.from, query.to);
  }

  @Get('regions')
  async getRegions(
    @Query() query: AnalyticsQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    return this.metrics.getRegions(orgId, {
      from: query.from,
      to: query.to,
      metric: query.metric,
    });
  }

  @Get('storage-series')
  async getStorageSeries(
    @Query() query: AnalyticsQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    // Query params arrive as strings — ValidationPipe returns the plain payload.
    const days = Math.min(365, Math.max(1, Number(query.days) || 30));
    return this.metrics.getStorageSeries(orgId, days);
  }

  @Get('transfer-series')
  async getTransferSeries(
    @Query() query: AnalyticsQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    const days = Math.min(365, Math.max(1, Number(query.days) || 30));
    return this.metrics.getTransferSeries(orgId, days);
  }

  @Get('downloads')
  async listDownloads(
    @Query() query: AnalyticsQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    // Query params arrive as strings — ValidationPipe returns the plain payload
    // after validating a transformed copy, so coerce before limit/offset.
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return this.metrics.listDownloads(orgId, {
      page,
      limit,
      search: query.search,
      country: toStringArray(query.country),
      method: toStringArray(query.method),
      device: toStringArray(query.device),
      minBytes: query.minBytes,
      maxBytes: query.maxBytes,
      from: query.from,
      to: query.to,
      sort: query.sort,
      order: query.order,
    });
  }
}
