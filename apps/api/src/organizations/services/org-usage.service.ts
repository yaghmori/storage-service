import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';
import { OrganizationService } from '../organization.service';
import { OrgLimitsService } from './org-limits.service';
import { OrgRetentionService } from './org-retention.service';

export type OrgUsageBreakdownCategory =
  | 'documents'
  | 'images'
  | 'videos'
  | 'audio'
  | 'other';

export type OrgUsageBreakdownSegment = {
  category: OrgUsageBreakdownCategory;
  label: string;
  bytes: number;
  count: number;
};

export type OrgUsageSnapshot = {
  usedBytes: number;
  objectCount: number;
  storageQuotaBytes: number | null;
  maxObjectCount: number | null;
  maxFileSizeBytes: number;
  softDeleteRetentionDays: number;
  breakdown: OrgUsageBreakdownSegment[];
};

const BREAKDOWN_LABELS: Record<OrgUsageBreakdownCategory, string> = {
  documents: 'Documents',
  images: 'Images',
  videos: 'Videos',
  audio: 'Audio',
  other: 'Other',
};

const EMPTY_BREAKDOWN: OrgUsageBreakdownSegment[] = (
  Object.keys(BREAKDOWN_LABELS) as OrgUsageBreakdownCategory[]
).map((category) => ({
  category,
  label: BREAKDOWN_LABELS[category],
  bytes: 0,
  count: 0,
}));

@Injectable()
export class OrgUsageService {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly organizations: OrganizationService,
    private readonly limitsService: OrgLimitsService,
    private readonly retentionService: OrgRetentionService,
  ) {}

  async getUsage(orgId: string): Promise<OrgUsageSnapshot> {
    const org = await this.organizations.getById(orgId);
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    const limits = await this.limitsService.resolve(orgId);
    const retention = await this.retentionService.resolve(orgId);
    const breakdown = await this.getBreakdown(orgId);
    return {
      usedBytes: Number(org.usedBytes ?? 0n),
      objectCount: org.objectCount ?? 0,
      storageQuotaBytes: limits.storageQuotaBytes,
      maxObjectCount: limits.maxObjectCount,
      maxFileSizeBytes: limits.maxFileSizeBytes,
      softDeleteRetentionDays: retention.softDeleteRetentionDays,
      breakdown,
    };
  }

  /** Bytes/count by MIME family. Soft-deleted rows still count until hard purge. */
  private async getBreakdown(
    orgId: string,
  ): Promise<OrgUsageBreakdownSegment[]> {
    const categoryExpr = sql`CASE
      WHEN ${schema.files.mimeType} LIKE 'image/%' THEN 'images'
      WHEN ${schema.files.mimeType} LIKE 'video/%' THEN 'videos'
      WHEN ${schema.files.mimeType} LIKE 'audio/%' THEN 'audio'
      WHEN ${schema.files.mimeType} LIKE 'application/%'
        OR ${schema.files.mimeType} LIKE 'text/%' THEN 'documents'
      ELSE 'other'
    END`;

    const rows = await this.db
      .select({
        category: sql<OrgUsageBreakdownCategory>`${categoryExpr}`,
        bytes: sql<string>`COALESCE(SUM(${schema.files.size}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.files)
      .where(eq(schema.files.orgId, orgId))
      .groupBy(categoryExpr);

    const byCategory = new Map(
      rows.map((row) => [
        row.category,
        {
          category: row.category,
          label: BREAKDOWN_LABELS[row.category] ?? BREAKDOWN_LABELS.other,
          bytes: Number(row.bytes ?? 0),
          count: Number(row.count ?? 0),
        } satisfies OrgUsageBreakdownSegment,
      ]),
    );

    return EMPTY_BREAKDOWN.map(
      (segment) => byCategory.get(segment.category) ?? segment,
    );
  }

  /** Increment usage after a new object is stored (not on duplicate ref bumps). */
  async increment(orgId: string, bytes: number | bigint): Promise<void> {
    const size = typeof bytes === 'bigint' ? bytes : BigInt(bytes);
    await this.db
      .update(schema.organizations)
      .set({
        usedBytes: sql`${schema.organizations.usedBytes} + ${size}`,
        objectCount: sql`${schema.organizations.objectCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, orgId));
  }

  /** Decrement when a file is hard-purged from storage. */
  async decrement(orgId: string, bytes: number | bigint): Promise<void> {
    const size = typeof bytes === 'bigint' ? bytes : BigInt(bytes);
    await this.db
      .update(schema.organizations)
      .set({
        usedBytes: sql`GREATEST(0, ${schema.organizations.usedBytes} - ${size})`,
        objectCount: sql`GREATEST(0, ${schema.organizations.objectCount} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, orgId));
  }

  /** Recompute counters from files table (ops / repair). */
  async recalculate(orgId: string): Promise<OrgUsageSnapshot> {
    const org = await this.organizations.getById(orgId);
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);

    const [row] = await this.db
      .select({
        totalBytes: sql<string>`COALESCE(SUM(${schema.files.size}), 0)`,
        totalCount: sql<number>`COUNT(*)::int`,
      })
      .from(schema.files)
      .where(eq(schema.files.orgId, orgId));

    const usedBytes = BigInt(row?.totalBytes ?? '0');
    const objectCount = Number(row?.totalCount ?? 0);

    await this.db
      .update(schema.organizations)
      .set({
        usedBytes,
        objectCount,
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, orgId));

    return this.getUsage(orgId);
  }
}
