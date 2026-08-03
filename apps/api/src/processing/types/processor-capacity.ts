import { ProcessorKey } from '@workspace/validation';

export type ProcessorCapacity = {
  concurrency: number;
  rateMax: number | null;
  rateDurationMs: number | null;
};

/** Defaults aligned with former platform queue settings. */
export const DEFAULT_PROCESSOR_CAPACITY: Record<string, ProcessorCapacity> = {
  [ProcessorKey.IMAGE_NORMALIZE]: {
    concurrency: 2,
    rateMax: null,
    rateDurationMs: null,
  },
  [ProcessorKey.IMAGE_VARIANTS]: {
    concurrency: 2,
    rateMax: null,
    rateDurationMs: null,
  },
  [ProcessorKey.VIDEO_PREVIEW]: {
    concurrency: 1,
    rateMax: 2,
    rateDurationMs: 60_000,
  },
  [ProcessorKey.METADATA_EXIF]: {
    concurrency: 3,
    rateMax: null,
    rateDurationMs: null,
  },
  [ProcessorKey.AI_VISION]: {
    concurrency: 1,
    rateMax: 2,
    rateDurationMs: 60_000,
  },
  [ProcessorKey.DEDUPE_PHASH]: {
    concurrency: 2,
    rateMax: null,
    rateDurationMs: null,
  },
  [ProcessorKey.INTEGRITY_VERIFY]: {
    concurrency: 2,
    rateMax: null,
    rateDurationMs: null,
  },
  [ProcessorKey.DOCUMENT_PREVIEW]: {
    concurrency: 2,
    rateMax: 10,
    rateDurationMs: 60_000,
  },
  [ProcessorKey.DOCUMENT_TEXT]: {
    concurrency: 2,
    rateMax: 10,
    rateDurationMs: 60_000,
  },
  [ProcessorKey.DOCUMENT_OCR]: {
    concurrency: 1,
    rateMax: 4,
    rateDurationMs: 60_000,
  },
  [ProcessorKey.NOTIFY_WEBHOOK]: {
    concurrency: 4,
    rateMax: null,
    rateDurationMs: null,
  },
};

const CAPACITY_KEYS = new Set(['concurrency', 'rateMax', 'rateDurationMs']);

export function defaultCapacityFor(processorKey: string): ProcessorCapacity {
  return (
    DEFAULT_PROCESSOR_CAPACITY[processorKey] ?? {
      concurrency: 1,
      rateMax: null,
      rateDurationMs: null,
    }
  );
}

export function clampConcurrency(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(32, Math.max(1, Math.floor(n)));
}

export function normalizeCapacity(
  raw: Partial<ProcessorCapacity> | null | undefined,
  processorKey: string,
): ProcessorCapacity {
  const fallback = defaultCapacityFor(processorKey);
  const concurrency = clampConcurrency(
    raw?.concurrency != null ? Number(raw.concurrency) : fallback.concurrency,
  );
  const rateMax =
    raw?.rateMax == null || Number(raw.rateMax) <= 0
      ? null
      : Math.max(1, Math.floor(Number(raw.rateMax)));
  const rateDurationMs =
    raw?.rateDurationMs == null || Number(raw.rateDurationMs) <= 0
      ? null
      : Math.max(1000, Math.floor(Number(raw.rateDurationMs)));
  return { concurrency, rateMax, rateDurationMs };
}

export function extractCapacity(
  settings: Record<string, unknown> | null | undefined,
  processorKey: string,
): ProcessorCapacity {
  if (!settings) return defaultCapacityFor(processorKey);
  return normalizeCapacity(
    {
      concurrency:
        typeof settings.concurrency === 'number'
          ? settings.concurrency
          : undefined,
      rateMax:
        settings.rateMax === null
          ? null
          : typeof settings.rateMax === 'number'
            ? settings.rateMax
            : undefined,
      rateDurationMs:
        settings.rateDurationMs === null
          ? null
          : typeof settings.rateDurationMs === 'number'
            ? settings.rateDurationMs
            : undefined,
    },
    processorKey,
  );
}

export function withCapacity(
  settings: Record<string, unknown>,
  capacity: ProcessorCapacity,
): Record<string, unknown> {
  return {
    ...settings,
    concurrency: capacity.concurrency,
    rateMax: capacity.rateMax,
    rateDurationMs: capacity.rateDurationMs,
  };
}

export function stripCapacity(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (CAPACITY_KEYS.has(key)) continue;
    next[key] = value;
  }
  return next;
}

export type ProcessorCapacityMap = Record<string, ProcessorCapacity>;

export function emptyCapacityMap(): ProcessorCapacityMap {
  const map: ProcessorCapacityMap = {};
  for (const key of Object.keys(DEFAULT_PROCESSOR_CAPACITY)) {
    map[key] = { ...DEFAULT_PROCESSOR_CAPACITY[key]! };
  }
  return map;
}
