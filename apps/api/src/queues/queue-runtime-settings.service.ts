/**
 * Process-wide BullMQ worker options (hard ceiling).
 * Per-org concurrency/rate live on org_processors.settings and are enforced
 * by OrgProcessorCapacityService.
 */

export type QueueRuntimeSetting = {
  concurrency: number;
  rateMax: number | null;
  rateDurationMs: number | null;
  paused: boolean;
};

export type QueueRuntimeSettingsMap = Record<string, QueueRuntimeSetting>;

import {
  AI_VISION_QUEUE,
  DEDUPE_PHASH_QUEUE,
  DOCUMENT_OCR_QUEUE,
  DOCUMENT_PREVIEW_QUEUE,
  DOCUMENT_TEXT_QUEUE,
  IMAGE_NORMALIZE_QUEUE,
  IMAGE_PROCESSING_QUEUE,
  INTEGRITY_VERIFY_QUEUE,
  METADATA_EXTRACTION_QUEUE,
  NOTIFY_WEBHOOK_QUEUE,
  VIDEO_PROCESSING_QUEUE,
  VIRUS_SCAN_QUEUE,
} from './queue-names';

export const DEFAULT_QUEUE_SETTINGS: QueueRuntimeSettingsMap = {
  [VIRUS_SCAN_QUEUE]: {
    concurrency: 2,
    rateMax: 4,
    rateDurationMs: 60_000,
    paused: false,
  },
  [METADATA_EXTRACTION_QUEUE]: {
    concurrency: 3,
    rateMax: null,
    rateDurationMs: null,
    paused: false,
  },
  [IMAGE_NORMALIZE_QUEUE]: {
    concurrency: 2,
    rateMax: null,
    rateDurationMs: null,
    paused: false,
  },
  [IMAGE_PROCESSING_QUEUE]: {
    concurrency: 2,
    rateMax: null,
    rateDurationMs: null,
    paused: false,
  },
  [VIDEO_PROCESSING_QUEUE]: {
    concurrency: 1,
    rateMax: 2,
    rateDurationMs: 60_000,
    paused: false,
  },
  [AI_VISION_QUEUE]: {
    concurrency: 1,
    rateMax: 2,
    rateDurationMs: 60_000,
    paused: false,
  },
  [DEDUPE_PHASH_QUEUE]: {
    concurrency: 2,
    rateMax: null,
    rateDurationMs: null,
    paused: false,
  },
  [INTEGRITY_VERIFY_QUEUE]: {
    concurrency: 2,
    rateMax: null,
    rateDurationMs: null,
    paused: false,
  },
  [DOCUMENT_PREVIEW_QUEUE]: {
    concurrency: 2,
    rateMax: 10,
    rateDurationMs: 60_000,
    paused: false,
  },
  [DOCUMENT_TEXT_QUEUE]: {
    concurrency: 2,
    rateMax: 10,
    rateDurationMs: 60_000,
    paused: false,
  },
  [DOCUMENT_OCR_QUEUE]: {
    concurrency: 1,
    rateMax: 4,
    rateDurationMs: 60_000,
    paused: false,
  },
  [NOTIFY_WEBHOOK_QUEUE]: {
    concurrency: 4,
    rateMax: null,
    rateDurationMs: null,
    paused: false,
  },
};

function clampConcurrency(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(32, Math.max(1, Math.floor(n)));
}

/** Resolve Nest @Processor options from defaults + optional env override. */
export function processorWorkerOptions(queueName: string): {
  concurrency: number;
  limiter?: { max: number; duration: number };
} {
  const s =
    DEFAULT_QUEUE_SETTINGS[queueName] ??
    ({
      concurrency: 1,
      rateMax: null,
      rateDurationMs: null,
      paused: false,
    } satisfies QueueRuntimeSetting);

  const envConc =
    process.env[
      `QUEUE_CONCURRENCY_${queueName.replace(/-/g, '_').toUpperCase()}`
    ];
  const concurrency = envConc
    ? clampConcurrency(Number(envConc))
    : s.concurrency;

  if (s.rateMax && s.rateDurationMs) {
    return {
      concurrency,
      limiter: { max: s.rateMax, duration: s.rateDurationMs },
    };
  }
  return { concurrency };
}
