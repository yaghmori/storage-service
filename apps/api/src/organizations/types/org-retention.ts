export type OrgRetentionSettings = {
  softDeleteRetentionDays: number;
};

export type OrgRetentionOverride = Partial<OrgRetentionSettings>;

export const PLATFORM_RETENTION_DEFAULTS: OrgRetentionSettings = {
  softDeleteRetentionDays: 30,
};

const METADATA_KEY = 'retention';

function asPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), 3650);
}

export function extractRetentionFromMetadata(
  metadata: unknown,
): OrgRetentionOverride | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const root = metadata as Record<string, unknown>;
  const raw = root[METADATA_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return raw as OrgRetentionOverride;
}

export function mergeRetentionSettings(
  ...layers: Array<OrgRetentionOverride | null | undefined>
): OrgRetentionSettings {
  const base = { ...PLATFORM_RETENTION_DEFAULTS };
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.softDeleteRetentionDays !== undefined) {
      base.softDeleteRetentionDays = asPositiveInt(
        layer.softDeleteRetentionDays,
        base.softDeleteRetentionDays,
      );
    }
  }
  return base;
}

export function withRetentionInMetadata(
  metadata: unknown,
  retention: OrgRetentionSettings,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  base[METADATA_KEY] = retention;
  return base;
}
