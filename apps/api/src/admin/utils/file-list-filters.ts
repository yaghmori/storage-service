import { BadRequestException } from '@nestjs/common';
import {
  and,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  not,
  or,
  SQL,
  sql,
} from 'drizzle-orm';
import * as schema from '../../database/drizzle/schema';

/** MIME families aligned with org usage breakdown. */
export const FILE_TYPE_FILTERS = [
  'images',
  'videos',
  'audio',
  'documents',
  'other',
] as const;

export type FileTypeFilter = (typeof FILE_TYPE_FILTERS)[number];

export const PROCESSING_STATUS_FILTERS = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'partial',
  'skipped',
] as const;

export type ProcessingStatusFilter = (typeof PROCESSING_STATUS_FILTERS)[number];

export function parseFileTypeFilter(raw: string): FileTypeFilter[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  const allowed = FILE_TYPE_FILTERS as readonly string[];
  const invalid = parts.filter((s) => !allowed.includes(s));
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Invalid fileType value(s): ${invalid.join(', ')}. Allowed: ${FILE_TYPE_FILTERS.join(', ')}`,
    );
  }
  return [...new Set(parts)] as FileTypeFilter[];
}

export function parseProcessingStatusFilter(
  raw: string,
): ProcessingStatusFilter[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  const allowed = PROCESSING_STATUS_FILTERS as readonly string[];
  const invalid = parts.filter((s) => !allowed.includes(s));
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Invalid processingStatus value(s): ${invalid.join(', ')}. Allowed: ${PROCESSING_STATUS_FILTERS.join(', ')}`,
    );
  }
  return [...new Set(parts)] as ProcessingStatusFilter[];
}

/** Same MIME families as org usage breakdown. */
export function mimeTypeConditionForFileType(
  fileType: FileTypeFilter,
): SQL | undefined {
  switch (fileType) {
    case 'images':
      return like(schema.files.mimeType, 'image/%');
    case 'videos':
      return like(schema.files.mimeType, 'video/%');
    case 'audio':
      return like(schema.files.mimeType, 'audio/%');
    case 'documents':
      return or(
        like(schema.files.mimeType, 'application/%'),
        like(schema.files.mimeType, 'text/%'),
      )!;
    case 'other':
      return and(
        not(like(schema.files.mimeType, 'image/%')),
        not(like(schema.files.mimeType, 'video/%')),
        not(like(schema.files.mimeType, 'audio/%')),
        not(like(schema.files.mimeType, 'application/%')),
        not(like(schema.files.mimeType, 'text/%')),
      )!;
    default:
      return undefined;
  }
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCreatedBound(value: string, endOfDay: boolean): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date "${value}"`);
  }
  if (endOfDay && DATE_ONLY_RE.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

export type FileListFilters = {
  search?: string;
  fileType?: string;
  processingStatus?: string;
  minSize?: number | string;
  maxSize?: number | string;
  createdFrom?: string;
  createdTo?: string;
  includeDeleted?: boolean;
  deletedOnly?: boolean;
};

/**
 * Single source of truth for the Files table result set, shared by the paginated
 * list endpoint and bulk actions that operate on "everything matching filters"
 * so both always resolve the identical set of rows.
 */
export function buildFileListConditions(
  orgId: string,
  filters: FileListFilters,
): SQL[] {
  const conditions: SQL[] = [eq(schema.files.orgId, orgId)];

  if (filters.deletedOnly) {
    conditions.push(isNotNull(schema.files.deletedAt));
  } else if (!filters.includeDeleted) {
    conditions.push(isNull(schema.files.deletedAt));
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(schema.files.originalFileName, term),
        ilike(schema.files.mimeType, term),
        sql`${schema.files.id}::text ilike ${term}`,
      )!,
    );
  }

  if (filters.fileType?.trim()) {
    const types = parseFileTypeFilter(filters.fileType);
    const mimeConditions = types
      .map((t) => mimeTypeConditionForFileType(t))
      .filter((c): c is SQL => c != null);
    if (mimeConditions.length === 1) {
      conditions.push(mimeConditions[0]!);
    } else if (mimeConditions.length > 1) {
      conditions.push(or(...mimeConditions)!);
    }
  }

  if (filters.processingStatus?.trim()) {
    const statuses = parseProcessingStatusFilter(filters.processingStatus);
    if (statuses.length === 1) {
      conditions.push(eq(schema.files.processingStatus, statuses[0]!));
    } else if (statuses.length > 1) {
      conditions.push(inArray(schema.files.processingStatus, statuses));
    }
  }

  const minSize = Number(filters.minSize);
  const maxSize = Number(filters.maxSize);
  if (Number.isFinite(minSize) && minSize >= 0) {
    conditions.push(gte(schema.files.size, BigInt(minSize)));
  }
  if (Number.isFinite(maxSize) && maxSize >= 0) {
    conditions.push(lte(schema.files.size, BigInt(maxSize)));
  }

  if (filters.createdFrom?.trim()) {
    conditions.push(
      gte(schema.files.createdAt, parseCreatedBound(filters.createdFrom, false)),
    );
  }
  if (filters.createdTo?.trim()) {
    conditions.push(
      lte(schema.files.createdAt, parseCreatedBound(filters.createdTo, true)),
    );
  }

  return conditions;
}
