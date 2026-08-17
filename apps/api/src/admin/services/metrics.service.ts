import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
  sum,
  type SQL,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';
import {
  COUNTRY_CENTROIDS,
  MACRO_REGION_LABELS,
  resolveMacroRegion,
  type MacroRegion,
} from '../../analytics/utils/geo-regions';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseDateParam(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type DeviceCategory = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'other';

const DEVICE_CATEGORIES: readonly DeviceCategory[] = [
  'desktop',
  'mobile',
  'tablet',
  'bot',
  'other',
];

/** Accepts a repeated query param, a comma-joined string, or nothing. */
function toFilterList(value?: string[] | string): string[] {
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function eachDayInclusive(from: Date, to: Date): string[] {
  const days: string[] = [];
  let cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    days.push(toDayKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

@Injectable()
export class MetricsService {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  resolveRange(from?: string, to?: string, defaultDays = 14) {
    const parsedTo = parseDateParam(to) ?? new Date();
    const end = startOfDay(parsedTo);
    const parsedFrom = parseDateParam(from);
    const start = startOfDay(
      parsedFrom ?? addDays(end, -(defaultDays - 1)),
    );
    const dayCount =
      Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) +
          1,
      );
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(prevEnd, -(dayCount - 1));
    // Inclusive end-of-day for queries: next midnight exclusive feel via end+1d
    const endExclusive = addDays(end, 1);
    const prevEndExclusive = addDays(prevEnd, 1);
    return {
      start,
      end,
      endExclusive,
      prevStart,
      prevEnd,
      prevEndExclusive,
      dayCount,
    };
  }

  async getSummary(orgId: string, from?: string, to?: string) {
    const range = this.resolveRange(from, to, 14);
    const orgFilter = eq(schema.downloadLogs.orgId, orgId);

    const [[totals], [period], [previous], downloadsByDay] = await Promise.all([
      this.db
        .select({
          totalDownloads: count(),
          bytesDownloaded: sum(schema.downloadLogs.bytesDownloaded),
        })
        .from(schema.downloadLogs)
        .where(orgFilter),
      this.db
        .select({
          downloads: count(),
          bytes: sum(schema.downloadLogs.bytesDownloaded),
        })
        .from(schema.downloadLogs)
        .where(
          and(
            orgFilter,
            gte(schema.downloadLogs.downloadedAt, range.start),
            lt(schema.downloadLogs.downloadedAt, range.endExclusive),
          ),
        ),
      this.db
        .select({
          downloads: count(),
          bytes: sum(schema.downloadLogs.bytesDownloaded),
        })
        .from(schema.downloadLogs)
        .where(
          and(
            orgFilter,
            gte(schema.downloadLogs.downloadedAt, range.prevStart),
            lt(schema.downloadLogs.downloadedAt, range.prevEndExclusive),
          ),
        ),
      this.db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${schema.downloadLogs.downloadedAt}), 'YYYY-MM-DD')`,
          downloads: count(),
          bytes: sum(schema.downloadLogs.bytesDownloaded),
        })
        .from(schema.downloadLogs)
        .where(
          and(
            orgFilter,
            gte(schema.downloadLogs.downloadedAt, range.start),
            lt(schema.downloadLogs.downloadedAt, range.endExclusive),
          ),
        )
        .groupBy(sql`date_trunc('day', ${schema.downloadLogs.downloadedAt})`)
        .orderBy(sql`date_trunc('day', ${schema.downloadLogs.downloadedAt})`),
    ]);

    const byDayMap = new Map(
      downloadsByDay.map((row) => [
        row.day,
        { downloads: Number(row.downloads), bytes: Number(row.bytes ?? 0) },
      ]),
    );
    const filled = eachDayInclusive(range.start, range.end).map((day) => ({
      day,
      downloads: byDayMap.get(day)?.downloads ?? 0,
      bytes: byDayMap.get(day)?.bytes ?? 0,
    }));

    return {
      totalDownloads: Number(totals?.totalDownloads ?? 0),
      bytesDownloaded: Number(totals?.bytesDownloaded ?? 0),
      periodDownloads: Number(period?.downloads ?? 0),
      periodBytes: Number(period?.bytes ?? 0),
      previousDownloads: Number(previous?.downloads ?? 0),
      previousBytes: Number(previous?.bytes ?? 0),
      downloadsByDay: filled,
      from: toDayKey(range.start),
      to: toDayKey(range.end),
    };
  }

  async getRegions(
    orgId: string,
    opts: { from?: string; to?: string; metric?: 'requests' | 'bytes' },
  ) {
    const range = this.resolveRange(opts.from, opts.to, 14);
    const rows = await this.db
      .select({
        countryCode: schema.downloadLogs.countryCode,
        regionCode: schema.downloadLogs.regionCode,
        requests: count(),
        bytes: sum(schema.downloadLogs.bytesDownloaded),
        avgLat: sql<string | null>`avg(${schema.downloadLogs.latitude}::float8)`,
        avgLon: sql<string | null>`avg(${schema.downloadLogs.longitude}::float8)`,
      })
      .from(schema.downloadLogs)
      .where(
        and(
          eq(schema.downloadLogs.orgId, orgId),
          gte(schema.downloadLogs.downloadedAt, range.start),
          lt(schema.downloadLogs.downloadedAt, range.endExclusive),
        ),
      )
      .groupBy(
        schema.downloadLogs.countryCode,
        schema.downloadLogs.regionCode,
      );

    const countries = rows.map((row) => {
      const countryCode = row.countryCode?.toUpperCase() ?? null;
      const longitude =
        row.avgLon != null && Number.isFinite(Number(row.avgLon))
          ? Number(row.avgLon)
          : (countryCode ? COUNTRY_CENTROIDS[countryCode]?.[1] : null) ?? null;
      const latitude =
        row.avgLat != null && Number.isFinite(Number(row.avgLat))
          ? Number(row.avgLat)
          : (countryCode ? COUNTRY_CENTROIDS[countryCode]?.[0] : null) ?? null;
      const region =
        (row.regionCode as MacroRegion | null) ??
        resolveMacroRegion(countryCode, longitude);
      return {
        countryCode,
        region,
        requests: Number(row.requests),
        bytes: Number(row.bytes ?? 0),
        lat: latitude,
        lon: longitude,
      };
    });

    const totalRequests = countries.reduce((s, c) => s + c.requests, 0);
    const totalBytes = countries.reduce((s, c) => s + c.bytes, 0);
    const metric = opts.metric === 'bytes' ? 'bytes' : 'requests';
    const total = metric === 'bytes' ? totalBytes : totalRequests;

    const regionMap = new Map<
      MacroRegion,
      { requests: number; bytes: number }
    >();
    for (const c of countries) {
      const prev = regionMap.get(c.region) ?? { requests: 0, bytes: 0 };
      prev.requests += c.requests;
      prev.bytes += c.bytes;
      regionMap.set(c.region, prev);
    }

    const regions = (
      Object.keys(MACRO_REGION_LABELS) as MacroRegion[]
    )
      .map((region) => {
        const stats = regionMap.get(region) ?? { requests: 0, bytes: 0 };
        const value = metric === 'bytes' ? stats.bytes : stats.requests;
        return {
          region,
          label: MACRO_REGION_LABELS[region],
          requests: stats.requests,
          bytes: stats.bytes,
          share: total > 0 ? value / total : 0,
        };
      })
      .filter((r) => r.requests > 0 || r.bytes > 0)
      .sort((a, b) => b.share - a.share);

    return {
      total,
      totalRequests,
      totalBytes,
      metric,
      regions,
      countries: countries.filter((c) => c.countryCode),
      from: toDayKey(range.start),
      to: toDayKey(range.end),
    };
  }

  async getStorageSeries(orgId: string, days = 30) {
    const safeDays = Math.min(Math.max(days, 1), 365);
    const range = this.resolveRange(undefined, undefined, safeDays);

    const [[base], created, deleted, providers] = await Promise.all([
      this.db
        .select({
          bytes: sum(schema.files.size),
          objects: count(),
        })
        .from(schema.files)
        .where(
          and(
            eq(schema.files.orgId, orgId),
            lt(schema.files.createdAt, range.start),
            or(
              isNull(schema.files.deletedAt),
              gte(schema.files.deletedAt, range.start),
            ),
          ),
        ),
      this.db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${schema.files.createdAt}), 'YYYY-MM-DD')`,
          bytes: sum(schema.files.size),
          objects: count(),
          providerId: schema.files.storageProviderId,
        })
        .from(schema.files)
        .where(
          and(
            eq(schema.files.orgId, orgId),
            gte(schema.files.createdAt, range.start),
            lt(schema.files.createdAt, range.endExclusive),
          ),
        )
        .groupBy(
          sql`date_trunc('day', ${schema.files.createdAt})`,
          schema.files.storageProviderId,
        ),
      this.db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${schema.files.deletedAt}), 'YYYY-MM-DD')`,
          bytes: sum(schema.files.size),
          objects: count(),
          providerId: schema.files.storageProviderId,
        })
        .from(schema.files)
        .where(
          and(
            eq(schema.files.orgId, orgId),
            gte(schema.files.deletedAt, range.start),
            lt(schema.files.deletedAt, range.endExclusive),
          ),
        )
        .groupBy(
          sql`date_trunc('day', ${schema.files.deletedAt})`,
          schema.files.storageProviderId,
        ),
      this.db
        .select({
          id: schema.storageProviders.id,
          name: schema.storageProviders.name,
          type: schema.storageProviders.type,
        })
        .from(schema.storageProviders)
        .where(eq(schema.storageProviders.orgId, orgId)),
    ]);

    const providerNames = new Map(
      providers.map((p) => [p.id, p.name || p.type]),
    );
    const providerIds = providers.map((p) => p.id);

    // Base totals by provider before window
    const baseByProvider = await this.db
      .select({
        providerId: schema.files.storageProviderId,
        bytes: sum(schema.files.size),
        objects: count(),
      })
      .from(schema.files)
      .where(
        and(
          eq(schema.files.orgId, orgId),
            lt(schema.files.createdAt, range.start),
          or(
            isNull(schema.files.deletedAt),
            gte(schema.files.deletedAt, range.start),
          ),
        ),
      )
      .groupBy(schema.files.storageProviderId);

    const running = new Map<
      string,
      { bytes: number; objects: number }
    >();
    for (const row of baseByProvider) {
      running.set(row.providerId, {
        bytes: Number(row.bytes ?? 0),
        objects: Number(row.objects ?? 0),
      });
    }
    for (const id of providerIds) {
      if (!running.has(id)) running.set(id, { bytes: 0, objects: 0 });
    }

    const createdMap = new Map<string, Map<string, { bytes: number; objects: number }>>();
    for (const row of created) {
      if (!createdMap.has(row.day)) createdMap.set(row.day, new Map());
      createdMap.get(row.day)!.set(row.providerId, {
        bytes: Number(row.bytes ?? 0),
        objects: Number(row.objects ?? 0),
      });
    }
    const deletedMap = new Map<string, Map<string, { bytes: number; objects: number }>>();
    for (const row of deleted) {
      if (!deletedMap.has(row.day)) deletedMap.set(row.day, new Map());
      deletedMap.get(row.day)!.set(row.providerId, {
        bytes: Number(row.bytes ?? 0),
        objects: Number(row.objects ?? 0),
      });
    }

    const series: Array<{
      day: string;
      storedBytes: number;
      uploadedBytes: number;
      objectCount: number;
      byProvider: Array<{
        providerId: string;
        name: string;
        storedBytes: number;
        uploadedBytes: number;
        objectCount: number;
      }>;
    }> = [];

    for (const day of eachDayInclusive(range.start, range.end)) {
      const dayCreated = createdMap.get(day);
      const dayDeleted = deletedMap.get(day);
      for (const [providerId, stats] of running) {
        const add = dayCreated?.get(providerId);
        const rem = dayDeleted?.get(providerId);
        if (add) {
          stats.bytes += add.bytes;
          stats.objects += add.objects;
        }
        if (rem) {
          stats.bytes = Math.max(0, stats.bytes - rem.bytes);
          stats.objects = Math.max(0, stats.objects - rem.objects);
        }
      }
      const byProvider = [...running.entries()].map(([providerId, stats]) => ({
        providerId,
        name: providerNames.get(providerId) ?? 'Provider',
        storedBytes: stats.bytes,
        uploadedBytes: dayCreated?.get(providerId)?.bytes ?? 0,
        objectCount: stats.objects,
      }));
      const storedBytes = byProvider.reduce((s, p) => s + p.storedBytes, 0);
      const uploadedBytes = byProvider.reduce((s, p) => s + p.uploadedBytes, 0);
      const objectCount = byProvider.reduce((s, p) => s + p.objectCount, 0);
      series.push({
        day,
        storedBytes,
        uploadedBytes,
        objectCount,
        byProvider,
      });
    }

    const averageBytes =
      series.length === 0
        ? 0
        : series.reduce((s, row) => s + row.storedBytes, 0) / series.length;
    const latest = series[series.length - 1];

    return {
      averageBytes,
      currentBytes: latest?.storedBytes ?? Number(base?.bytes ?? 0),
      currentObjects: latest?.objectCount ?? Number(base?.objects ?? 0),
      series,
      from: toDayKey(range.start),
      to: toDayKey(range.end),
    };
  }

  /**
   * Buckets a download row by user-agent. Must stay in sync with the
   * client-side classifier in the admin downloads columns.
   */
  private deviceCategorySql() {
    return sql<DeviceCategory>`case
      when lower(coalesce(${schema.downloadLogs.userAgent}, '')) ~ '(bot|crawler|spider|slurp)' then 'bot'
      when lower(coalesce(${schema.downloadLogs.userAgent}, '')) ~ '(ipad|tablet|kindle|silk)' then 'tablet'
      when lower(coalesce(${schema.downloadLogs.userAgent}, '')) ~ '(mobile|iphone|ipod|android.*mobile)' then 'mobile'
      when lower(coalesce(${schema.downloadLogs.userAgent}, '')) ~ '(windows|macintosh|x11|cros|linux)' then 'desktop'
      else 'other'
    end`;
  }

  async getTransferSeries(orgId: string, days = 30) {
    const safeDays = Math.min(Math.max(days, 1), 365);
    const range = this.resolveRange(undefined, undefined, safeDays);

    const deviceCategory = this.deviceCategorySql();

    const [rows, deviceRows] = await Promise.all([
      this.db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${schema.downloadLogs.downloadedAt}), 'YYYY-MM-DD')`,
        bytesRetrieved: sum(schema.downloadLogs.bytesDownloaded),
        requests: count(),
      })
      .from(schema.downloadLogs)
      .where(
        and(
          eq(schema.downloadLogs.orgId, orgId),
          gte(schema.downloadLogs.downloadedAt, range.start),
          lt(schema.downloadLogs.downloadedAt, range.endExclusive),
        ),
      )
      .groupBy(sql`date_trunc('day', ${schema.downloadLogs.downloadedAt})`)
      .orderBy(sql`date_trunc('day', ${schema.downloadLogs.downloadedAt})`),
      this.db
        .select({
          device: deviceCategory,
          requests: count(),
          bytes: sum(schema.downloadLogs.bytesDownloaded),
        })
        .from(schema.downloadLogs)
        .where(
          and(
            eq(schema.downloadLogs.orgId, orgId),
            gte(schema.downloadLogs.downloadedAt, range.start),
            lt(schema.downloadLogs.downloadedAt, range.endExclusive),
          ),
        )
        .groupBy(deviceCategory),
    ]);

    const map = new Map(
      rows.map((row) => [
        row.day,
        {
          bytesRetrieved: Number(row.bytesRetrieved ?? 0),
          requests: Number(row.requests),
        },
      ]),
    );

    const series = eachDayInclusive(range.start, range.end).map((day) => ({
      day,
      bytesRetrieved: map.get(day)?.bytesRetrieved ?? 0,
      requests: map.get(day)?.requests ?? 0,
    }));

    const totalBytes = series.reduce((s, r) => s + r.bytesRetrieved, 0);
    const totalRequests = series.reduce((s, r) => s + r.requests, 0);

    return {
      totalBytes,
      totalRequests,
      devices: deviceRows
        .map((row) => ({
          device: row.device,
          requests: Number(row.requests),
          bytes: Number(row.bytes ?? 0),
        }))
        .sort((a, b) => b.requests - a.requests),
      series,
      from: toDayKey(range.start),
      to: toDayKey(range.end),
    };
  }

  async listDownloads(
    orgId: string,
    opts: {
      page?: number | string;
      limit?: number | string;
      search?: string;
      country?: string[] | string;
      method?: string[] | string;
      device?: string[] | string;
      minBytes?: number | string;
      maxBytes?: number | string;
      from?: string;
      to?: string;
      sort?: string;
      order?: 'asc' | 'desc';
    },
  ) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(schema.downloadLogs.orgId, orgId)];

    if (opts.from || opts.to) {
      const range = this.resolveRange(opts.from, opts.to, 30);
      conditions.push(gte(schema.downloadLogs.downloadedAt, range.start));
      conditions.push(lt(schema.downloadLogs.downloadedAt, range.endExclusive));
    }

    const codes = toFilterList(opts.country)
      .map((c) => c.toUpperCase())
      .filter((c) => c.length === 2);
    if (codes.length) {
      conditions.push(inArray(schema.downloadLogs.countryCode, codes));
    }

    const methods = toFilterList(opts.method).filter((m) =>
      ['direct', 'signed_url', 'cdn'].includes(m),
    ) as Array<'direct' | 'signed_url' | 'cdn'>;
    if (methods.length) {
      conditions.push(inArray(schema.downloadLogs.downloadMethod, methods));
    }

    const devices = toFilterList(opts.device)
      .map((d) => d.toLowerCase())
      .filter((d): d is DeviceCategory =>
        DEVICE_CATEGORIES.includes(d as DeviceCategory),
      );
    if (devices.length && devices.length < DEVICE_CATEGORIES.length) {
      conditions.push(inArray(this.deviceCategorySql(), devices));
    }

    const minBytes = Number(opts.minBytes);
    if (Number.isFinite(minBytes) && minBytes > 0) {
      conditions.push(
        gte(schema.downloadLogs.bytesDownloaded, BigInt(Math.floor(minBytes))),
      );
    }
    const maxBytes = Number(opts.maxBytes);
    if (Number.isFinite(maxBytes) && maxBytes > 0) {
      conditions.push(
        lte(schema.downloadLogs.bytesDownloaded, BigInt(Math.ceil(maxBytes))),
      );
    }

    if (opts.search?.trim()) {
      const q = `%${opts.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.files.originalFileName, q),
          ilike(schema.files.fileName, q),
          ilike(schema.downloadLogs.ipAddress, q),
          ilike(schema.downloadLogs.countryCode, q),
        )!,
      );
    }

    const where = and(...conditions);

    const sortKey = opts.sort ?? 'downloadedAt';
    const sortDir = opts.order === 'asc' ? asc : desc;
    const orderBy =
      sortKey === 'bytesDownloaded'
        ? sortDir(schema.downloadLogs.bytesDownloaded)
        : sortKey === 'countryCode'
          ? sortDir(schema.downloadLogs.countryCode)
          : sortKey === 'downloadMethod'
            ? sortDir(schema.downloadLogs.downloadMethod)
            : sortKey === 'fileName'
              ? sortDir(schema.files.originalFileName)
              : sortDir(schema.downloadLogs.downloadedAt);

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          id: schema.downloadLogs.id,
          orgId: schema.downloadLogs.orgId,
          fileId: schema.downloadLogs.fileId,
          variantId: schema.downloadLogs.variantId,
          ipAddress: schema.downloadLogs.ipAddress,
          userAgent: schema.downloadLogs.userAgent,
          userId: schema.downloadLogs.userId,
          bytesDownloaded: schema.downloadLogs.bytesDownloaded,
          downloadMethod: schema.downloadLogs.downloadMethod,
          referer: schema.downloadLogs.referer,
          countryCode: schema.downloadLogs.countryCode,
          regionCode: schema.downloadLogs.regionCode,
          city: schema.downloadLogs.city,
          latitude: schema.downloadLogs.latitude,
          longitude: schema.downloadLogs.longitude,
          downloadedAt: schema.downloadLogs.downloadedAt,
          fileName: schema.files.originalFileName,
          mimeType: schema.files.mimeType,
        })
        .from(schema.downloadLogs)
        .leftJoin(
          schema.files,
          eq(schema.downloadLogs.fileId, schema.files.id),
        )
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(schema.downloadLogs)
        .leftJoin(
          schema.files,
          eq(schema.downloadLogs.fileId, schema.files.id),
        )
        .where(where),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        bytesDownloaded:
          row.bytesDownloaded == null ? null : Number(row.bytesDownloaded),
      })),
      total: Number(totalResult[0]?.total ?? 0),
      page,
      limit,
    };
  }
}
