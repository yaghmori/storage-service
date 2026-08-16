export type OrgLimitsSettings = {
  /** null = fall back to platform MAX_FILE_SIZE */
  maxFileSizeBytes: number | null;
  /** null = fall back to platform ALLOWED_MIME_TYPES (empty platform list = allow all) */
  allowedMimeTypes: string[] | null;
  /** null = unlimited */
  storageQuotaBytes: number | null;
  /** null = unlimited */
  maxObjectCount: number | null;
  /**
   * Max upload HTTP requests per TTL window for API keys in this org
   * (when the key does not set its own rateLimitMax). null = platform RATE_LIMIT_MAX.
   */
  uploadRateLimitMax: number | null;
  /**
   * Upload rate-limit window in ms for API keys in this org
   * (when the key does not set its own rateLimitTtlMs). null = platform RATE_LIMIT_TTL_MS.
   */
  uploadRateLimitTtlMs: number | null;
};

export type OrgLimitsOverride = Partial<OrgLimitsSettings>;

/** Stored shape before platform merge; all optional / nullable. */
export const EMPTY_ORG_LIMITS: OrgLimitsSettings = {
  maxFileSizeBytes: null,
  allowedMimeTypes: null,
  storageQuotaBytes: null,
  maxObjectCount: null,
  uploadRateLimitMax: null,
  uploadRateLimitTtlMs: null,
};

/** Slice attached to authenticated requests for the upload throttler. */
export type OrgUploadRateLimit = {
  uploadRateLimitMax: number | null;
  uploadRateLimitTtlMs: number | null;
};

const METADATA_KEY = 'limits';

function asNullablePositiveInt(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function asNullableMimeList(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const types = value
    .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
    .filter(Boolean);
  return types.length > 0 ? [...new Set(types)] : null;
}

export function extractLimitsFromMetadata(
  metadata: unknown,
): OrgLimitsOverride | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const root = metadata as Record<string, unknown>;
  const raw = root[METADATA_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return raw as OrgLimitsOverride;
}

/** Org-level upload rate overrides only (null fields = use platform env). */
export function extractOrgUploadRateLimit(
  metadata: unknown,
): OrgUploadRateLimit {
  const limits = extractLimitsFromMetadata(metadata);
  return {
    uploadRateLimitMax:
      asNullablePositiveInt(limits?.uploadRateLimitMax) ?? null,
    uploadRateLimitTtlMs:
      asNullablePositiveInt(limits?.uploadRateLimitTtlMs) ?? null,
  };
}

export function mergeLimitsSettings(
  platform: {
    maxFileSizeBytes: number;
    allowedMimeTypes: string[];
  },
  ...layers: Array<OrgLimitsOverride | null | undefined>
): {
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
  storageQuotaBytes: number | null;
  maxObjectCount: number | null;
  uploadRateLimitMax: number | null;
  uploadRateLimitTtlMs: number | null;
  /** Raw org overrides (for admin GET). */
  org: OrgLimitsSettings;
} {
  const org: OrgLimitsSettings = { ...EMPTY_ORG_LIMITS };

  for (const layer of layers) {
    if (!layer) continue;
    if (layer.maxFileSizeBytes !== undefined) {
      const v = asNullablePositiveInt(layer.maxFileSizeBytes);
      if (v !== undefined) org.maxFileSizeBytes = v;
    }
    if (layer.allowedMimeTypes !== undefined) {
      const v = asNullableMimeList(layer.allowedMimeTypes);
      if (v !== undefined) org.allowedMimeTypes = v;
    }
    if (layer.storageQuotaBytes !== undefined) {
      const v = asNullablePositiveInt(layer.storageQuotaBytes);
      if (v !== undefined) org.storageQuotaBytes = v;
    }
    if (layer.maxObjectCount !== undefined) {
      const v = asNullablePositiveInt(layer.maxObjectCount);
      if (v !== undefined) org.maxObjectCount = v;
    }
    if (layer.uploadRateLimitMax !== undefined) {
      const v = asNullablePositiveInt(layer.uploadRateLimitMax);
      if (v !== undefined) org.uploadRateLimitMax = v;
    }
    if (layer.uploadRateLimitTtlMs !== undefined) {
      const v = asNullablePositiveInt(layer.uploadRateLimitTtlMs);
      if (v !== undefined) org.uploadRateLimitTtlMs = v;
    }
  }

  const maxFileSizeBytes =
    org.maxFileSizeBytes != null
      ? Math.min(org.maxFileSizeBytes, platform.maxFileSizeBytes)
      : platform.maxFileSizeBytes;

  const allowedMimeTypes =
    org.allowedMimeTypes != null && org.allowedMimeTypes.length > 0
      ? org.allowedMimeTypes
      : platform.allowedMimeTypes;

  return {
    maxFileSizeBytes,
    allowedMimeTypes,
    storageQuotaBytes: org.storageQuotaBytes,
    maxObjectCount: org.maxObjectCount,
    uploadRateLimitMax: org.uploadRateLimitMax,
    uploadRateLimitTtlMs: org.uploadRateLimitTtlMs,
    org,
  };
}

export function withLimitsInMetadata(
  metadata: unknown,
  limits: OrgLimitsSettings,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  base[METADATA_KEY] = limits;
  return base;
}
