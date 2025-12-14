import type { MetaResponse } from '../types/api-response.types';

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Format timestamp in ISO8601 format
 */
export function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Extract or generate request ID from Express Request headers
 * Checks for X-Request-ID header first (case-insensitive), then generates one
 */
export function getRequestId(headers: Record<string, unknown>): string {
  // Express headers can be lowercase or mixed case
  // Check common header name variations
  const headerId =
    headers['x-request-id'] ||
    headers['X-Request-ID'] ||
    headers['X-Request-Id'];

  if (typeof headerId === 'string' && headerId.length > 0) {
    return headerId;
  }

  return generateRequestId();
}

/**
 * Create meta object with required fields
 */
export function createMeta(
  headers: Record<string, unknown>,
  options?: {
    count?: number;
    total?: number;
    version?: string;
    duration?: number;
    cached?: boolean;
    message?: string;
  }
): MetaResponse {
  const meta: MetaResponse = {
    timestamp: formatTimestamp(),
    requestId: getRequestId(headers),
  };

  if (options?.count !== undefined) {
    meta.count = options.count;
  }

  if (options?.total !== undefined) {
    meta.total = options.total;
  }

  if (options?.version) {
    meta.version = options.version;
  }

  if (options?.duration !== undefined) {
    meta.duration = options.duration;
  }

  if (options?.cached !== undefined) {
    meta.cached = options.cached;
  }

  if (options?.message) {
    meta.message = options.message;
  }


  return meta;
}

/**
 * Add optional meta fields to existing meta object
 */
export function addMetaFields(
  meta: MetaResponse,
  fields?: {
    count?: number;
    total?: number;
    duration?: number;
    cached?: boolean;
  }
): MetaResponse {
  if (!fields) {
    return meta;
  }

  const updated = { ...meta };

  if (fields.count !== undefined) {
    updated.count = fields.count;
  }

  if (fields.total !== undefined) {
    updated.total = fields.total;
  }

  if (fields.duration !== undefined) {
    updated.duration = fields.duration;
  }

  if (fields.cached !== undefined) {
    updated.cached = fields.cached;
  }

  return updated;
}
