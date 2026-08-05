export type ImageFormat = 'webp' | 'avif';

export type ImageVariantName = 'thumbnail' | 'medium';

export type ImageVariantSlot = {
  enabled: boolean;
  /** Max width in pixels; height scales to preserve aspect ratio (no square crop). */
  maxEdge: number;
};

export type ImageVariantsConfig = {
  thumbnail: ImageVariantSlot;
  medium: ImageVariantSlot;
};

export type OrgProcessingSettings = {
  enableImageProcessing: boolean;
  enableVideoProcessing: boolean;
  enableMetadataExtraction: boolean;
  enableAiProcessing: boolean;
  enableAiCaption: boolean;
  enableAiTags: boolean;
  enableAiNsfw: boolean;
  nsfwThreshold: number;
  aiBackendId: string | null;
  /** Vision model for ai.vision (processor-level; backend defaultModels are fallback only). */
  aiVisionModel: string | null;
  /** OpenAI-compatible backend for document.ocr (independent of AI Vision). */
  documentOcrBackendId: string | null;
  /** Vision model for document.ocr. */
  documentOcrVisionModel: string | null;
  /** Named slots — primary config for thumbnail / medium. */
  imageVariants: ImageVariantsConfig;
  /**
   * Derived from enabled imageVariants (legacy / job payloads).
   * Prefer `imageVariants` when reading or writing settings.
   */
  imageSizes: number[];
  imageFormats: ImageFormat[];
  videoThumbnail: boolean;
  videoPreviewFrames: number;
  enableImageNormalize: boolean;
  enableDedupePhash: boolean;
  phashThresholdBits: number;
  enableIntegrityVerify: boolean;
  enableDocumentPreview: boolean;
  enableDocumentText: boolean;
  enableDocumentOcr: boolean;
  documentOcrEngine: 'openai_compatible' | 'tesseract';
  enableNotifyWebhook: boolean;
  notifyWebhookUrl: string;
  notifyWebhookSecret: string;
  notifyWebhookBearerToken: string;
  notifyWebhookHeaders: Array<{ name: string; value: string }>;
  notifyWebhookEvents: Array<
    'processing.completed' | 'processing.failed' | 'processing.partial'
  >;
  notifyWebhookIncludeDownloadUrl: boolean;
};

/** Optional per-upload overrides (partial). */
export type ProcessingSettingsOverride = Partial<
  Omit<OrgProcessingSettings, 'imageVariants' | 'imageSizes'>
> & {
  imageVariants?: Partial<{
    thumbnail: Partial<ImageVariantSlot>;
    medium: Partial<ImageVariantSlot>;
  }>;
  /** Legacy: first → thumbnail, second → medium. */
  imageSizes?: number[];
};

export const PLATFORM_PROCESSING_DEFAULTS: OrgProcessingSettings = {
  enableImageProcessing: true,
  enableVideoProcessing: true,
  enableMetadataExtraction: true,
  enableAiProcessing: false,
  enableAiCaption: true,
  enableAiTags: true,
  enableAiNsfw: true,
  nsfwThreshold: 0.7,
  aiBackendId: null,
  aiVisionModel: null,
  documentOcrBackendId: null,
  documentOcrVisionModel: null,
  imageVariants: {
    thumbnail: { enabled: true, maxEdge: 200 },
    medium: { enabled: true, maxEdge: 800 },
  },
  imageSizes: [200, 800],
  imageFormats: ['webp'],
  videoThumbnail: true,
  videoPreviewFrames: 3,
  enableImageNormalize: true,
  enableDedupePhash: false,
  phashThresholdBits: 10,
  enableIntegrityVerify: false,
  enableDocumentPreview: true,
  enableDocumentText: true,
  enableDocumentOcr: false,
  documentOcrEngine: 'openai_compatible',
  enableNotifyWebhook: false,
  notifyWebhookUrl: '',
  notifyWebhookSecret: '',
  notifyWebhookBearerToken: '',
  notifyWebhookHeaders: [],
  notifyWebhookEvents: [
    'processing.completed',
    'processing.failed',
    'processing.partial',
  ],
  notifyWebhookIncludeDownloadUrl: true,
};

const METADATA_KEY = 'processing';

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function asPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function clampEdge(value: unknown, fallback: number): number {
  const n = asPositiveInt(value, fallback);
  return Math.min(4096, Math.max(1, n));
}

function asImageFormats(value: unknown, fallback: ImageFormat[]): ImageFormat[] {
  if (!Array.isArray(value) || value.length === 0) return [...fallback];
  const formats = value.filter(
    (v): v is ImageFormat => v === 'webp' || v === 'avif',
  );
  return formats.length > 0 ? [...new Set(formats)] : [...fallback];
}

/** Convert legacy imageSizes array → named slots. */
export function imageVariantsFromLegacySizes(
  sizes: number[],
  fallback: ImageVariantsConfig = PLATFORM_PROCESSING_DEFAULTS.imageVariants,
): ImageVariantsConfig {
  const cleaned = [...new Set(sizes.map((n) => clampEdge(n, 0)).filter((n) => n > 0))]
    .sort((a, b) => a - b)
    .slice(0, 2);

  if (cleaned.length === 0) {
    return {
      thumbnail: { ...fallback.thumbnail },
      medium: { ...fallback.medium },
    };
  }

  if (cleaned.length === 1) {
    return {
      thumbnail: { enabled: true, maxEdge: cleaned[0]! },
      medium: { enabled: false, maxEdge: fallback.medium.maxEdge },
    };
  }

  return {
    thumbnail: { enabled: true, maxEdge: cleaned[0]! },
    medium: { enabled: true, maxEdge: cleaned[1]! },
  };
}

export function imageSizesFromVariants(variants: ImageVariantsConfig): number[] {
  const sizes: number[] = [];
  if (variants.thumbnail.enabled) sizes.push(variants.thumbnail.maxEdge);
  if (variants.medium.enabled) sizes.push(variants.medium.maxEdge);
  return sizes;
}

function mergeSlot(
  base: ImageVariantSlot,
  patch?: Partial<ImageVariantSlot> | null,
): ImageVariantSlot {
  if (!patch) return { ...base };
  return {
    enabled:
      patch.enabled !== undefined ? asBool(patch.enabled, base.enabled) : base.enabled,
    maxEdge:
      patch.maxEdge !== undefined ? clampEdge(patch.maxEdge, base.maxEdge) : base.maxEdge,
  };
}

/**
 * Normalize slots: clamp edges, enforce thumbnail ≤ medium when both enabled,
 * ensure at least one slot enabled when image processing is on.
 */
export function normalizeImageVariants(
  variants: ImageVariantsConfig,
  enableImageProcessing: boolean,
): ImageVariantsConfig {
  let thumbnail = {
    enabled: variants.thumbnail.enabled,
    maxEdge: clampEdge(variants.thumbnail.maxEdge, 200),
  };
  let medium = {
    enabled: variants.medium.enabled,
    maxEdge: clampEdge(variants.medium.maxEdge, 800),
  };

  if (thumbnail.enabled && medium.enabled && thumbnail.maxEdge > medium.maxEdge) {
    const tmp = thumbnail.maxEdge;
    thumbnail = { ...thumbnail, maxEdge: medium.maxEdge };
    medium = { ...medium, maxEdge: tmp };
  }

  if (enableImageProcessing && !thumbnail.enabled && !medium.enabled) {
    thumbnail = { ...thumbnail, enabled: true };
  }

  return { thumbnail, medium };
}

export type ImageVariantJobSlot = {
  name: ImageVariantName;
  maxEdge: number;
};

/** Enabled slots for the image processor (named, not order-inferred). */
export function enabledImageVariantSlots(
  settings: Pick<OrgProcessingSettings, 'imageVariants'>,
): ImageVariantJobSlot[] {
  const slots: ImageVariantJobSlot[] = [];
  const { thumbnail, medium } = settings.imageVariants;
  if (thumbnail.enabled) {
    slots.push({ name: 'thumbnail', maxEdge: thumbnail.maxEdge });
  }
  if (medium.enabled) {
    slots.push({ name: 'medium', maxEdge: medium.maxEdge });
  }
  return slots;
}

export function extractProcessingFromMetadata(
  metadata: unknown,
): ProcessingSettingsOverride | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const root = metadata as Record<string, unknown>;
  const raw = root[METADATA_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return raw as ProcessingSettingsOverride;
}

export function mergeProcessingSettings(
  ...layers: Array<ProcessingSettingsOverride | null | undefined>
): OrgProcessingSettings {
  let base: OrgProcessingSettings = {
    ...PLATFORM_PROCESSING_DEFAULTS,
    imageVariants: {
      thumbnail: { ...PLATFORM_PROCESSING_DEFAULTS.imageVariants.thumbnail },
      medium: { ...PLATFORM_PROCESSING_DEFAULTS.imageVariants.medium },
    },
    imageFormats: [...PLATFORM_PROCESSING_DEFAULTS.imageFormats],
    imageSizes: [...PLATFORM_PROCESSING_DEFAULTS.imageSizes],
  };

  for (const layer of layers) {
    if (!layer) continue;
    if (layer.enableImageProcessing !== undefined) {
      base.enableImageProcessing = asBool(
        layer.enableImageProcessing,
        base.enableImageProcessing,
      );
    }
    if (layer.enableVideoProcessing !== undefined) {
      base.enableVideoProcessing = asBool(
        layer.enableVideoProcessing,
        base.enableVideoProcessing,
      );
    }
    if (layer.enableMetadataExtraction !== undefined) {
      base.enableMetadataExtraction = asBool(
        layer.enableMetadataExtraction,
        base.enableMetadataExtraction,
      );
    }
    if (layer.enableAiProcessing !== undefined) {
      base.enableAiProcessing = asBool(
        layer.enableAiProcessing,
        base.enableAiProcessing,
      );
    }
    if (layer.enableAiCaption !== undefined) {
      base.enableAiCaption = asBool(layer.enableAiCaption, base.enableAiCaption);
    }
    if (layer.enableAiTags !== undefined) {
      base.enableAiTags = asBool(layer.enableAiTags, base.enableAiTags);
    }
    if (layer.enableAiNsfw !== undefined) {
      base.enableAiNsfw = asBool(layer.enableAiNsfw, base.enableAiNsfw);
    }
    if (layer.nsfwThreshold !== undefined) {
      const n =
        typeof layer.nsfwThreshold === 'number'
          ? layer.nsfwThreshold
          : Number(layer.nsfwThreshold);
      if (Number.isFinite(n)) {
        base.nsfwThreshold = Math.min(1, Math.max(0, n));
      }
    }
    if (layer.aiBackendId !== undefined) {
      base.aiBackendId =
        typeof layer.aiBackendId === 'string' && layer.aiBackendId.trim()
          ? layer.aiBackendId.trim()
          : null;
    }
    if (layer.aiVisionModel !== undefined) {
      base.aiVisionModel =
        typeof layer.aiVisionModel === 'string' && layer.aiVisionModel.trim()
          ? layer.aiVisionModel.trim()
          : null;
    }
    if (layer.documentOcrBackendId !== undefined) {
      base.documentOcrBackendId =
        typeof layer.documentOcrBackendId === 'string' &&
        layer.documentOcrBackendId.trim()
          ? layer.documentOcrBackendId.trim()
          : null;
    }
    if (layer.documentOcrVisionModel !== undefined) {
      base.documentOcrVisionModel =
        typeof layer.documentOcrVisionModel === 'string' &&
        layer.documentOcrVisionModel.trim()
          ? layer.documentOcrVisionModel.trim()
          : null;
    }

    if (layer.imageVariants !== undefined) {
      base.imageVariants = {
        thumbnail: mergeSlot(base.imageVariants.thumbnail, layer.imageVariants.thumbnail),
        medium: mergeSlot(base.imageVariants.medium, layer.imageVariants.medium),
      };
    } else if (layer.imageSizes !== undefined) {
      // Legacy only when imageVariants not provided on this layer.
      const sizes = Array.isArray(layer.imageSizes)
        ? layer.imageSizes
            .map((v) => clampEdge(v, 0))
            .filter((n) => n > 0)
        : [];
      if (sizes.length > 0) {
        base.imageVariants = imageVariantsFromLegacySizes(sizes, base.imageVariants);
      }
    }

    if (layer.imageFormats !== undefined) {
      base.imageFormats = asImageFormats(layer.imageFormats, base.imageFormats);
    }
    if (layer.videoThumbnail !== undefined) {
      base.videoThumbnail = asBool(layer.videoThumbnail, base.videoThumbnail);
    }
    if (layer.videoPreviewFrames !== undefined) {
      base.videoPreviewFrames = asPositiveInt(
        layer.videoPreviewFrames,
        base.videoPreviewFrames,
      );
    }
    if (layer.enableImageNormalize !== undefined) {
      base.enableImageNormalize = asBool(
        layer.enableImageNormalize,
        base.enableImageNormalize,
      );
    }
    if (layer.enableDedupePhash !== undefined) {
      base.enableDedupePhash = asBool(
        layer.enableDedupePhash,
        base.enableDedupePhash,
      );
    }
    if (layer.phashThresholdBits !== undefined) {
      const n =
        typeof layer.phashThresholdBits === 'number'
          ? layer.phashThresholdBits
          : Number(layer.phashThresholdBits);
      if (Number.isFinite(n)) {
        base.phashThresholdBits = Math.min(64, Math.max(0, Math.floor(n)));
      }
    }
    if (layer.enableIntegrityVerify !== undefined) {
      base.enableIntegrityVerify = asBool(
        layer.enableIntegrityVerify,
        base.enableIntegrityVerify,
      );
    }
    if (layer.enableDocumentPreview !== undefined) {
      base.enableDocumentPreview = asBool(
        layer.enableDocumentPreview,
        base.enableDocumentPreview,
      );
    }
    if (layer.enableDocumentText !== undefined) {
      base.enableDocumentText = asBool(
        layer.enableDocumentText,
        base.enableDocumentText,
      );
    }
    if (layer.enableDocumentOcr !== undefined) {
      base.enableDocumentOcr = asBool(
        layer.enableDocumentOcr,
        base.enableDocumentOcr,
      );
    }
    if (layer.documentOcrEngine !== undefined) {
      base.documentOcrEngine =
        layer.documentOcrEngine === 'tesseract'
          ? 'tesseract'
          : 'openai_compatible';
    }
    if (layer.enableNotifyWebhook !== undefined) {
      base.enableNotifyWebhook = asBool(
        layer.enableNotifyWebhook,
        base.enableNotifyWebhook,
      );
    }
    if (layer.notifyWebhookUrl !== undefined) {
      base.notifyWebhookUrl =
        typeof layer.notifyWebhookUrl === 'string'
          ? layer.notifyWebhookUrl
          : base.notifyWebhookUrl;
    }
    if (layer.notifyWebhookSecret !== undefined) {
      base.notifyWebhookSecret =
        typeof layer.notifyWebhookSecret === 'string'
          ? layer.notifyWebhookSecret
          : base.notifyWebhookSecret;
    }
    if (layer.notifyWebhookBearerToken !== undefined) {
      base.notifyWebhookBearerToken =
        typeof layer.notifyWebhookBearerToken === 'string'
          ? layer.notifyWebhookBearerToken
          : base.notifyWebhookBearerToken;
    }
    if (layer.notifyWebhookHeaders !== undefined) {
      base.notifyWebhookHeaders = Array.isArray(layer.notifyWebhookHeaders)
        ? (layer.notifyWebhookHeaders as Array<{ name: string; value: string }>)
        : base.notifyWebhookHeaders;
    }
    if (layer.notifyWebhookEvents !== undefined) {
      base.notifyWebhookEvents = Array.isArray(layer.notifyWebhookEvents)
        ? (layer.notifyWebhookEvents as OrgProcessingSettings['notifyWebhookEvents'])
        : base.notifyWebhookEvents;
    }
    if (layer.notifyWebhookIncludeDownloadUrl !== undefined) {
      base.notifyWebhookIncludeDownloadUrl = asBool(
        layer.notifyWebhookIncludeDownloadUrl,
        base.notifyWebhookIncludeDownloadUrl,
      );
    }
  }

  base.imageVariants = normalizeImageVariants(
    base.imageVariants,
    base.enableImageProcessing,
  );
  base.imageSizes = imageSizesFromVariants(base.imageVariants);
  return base;
}

/** Write processing settings into org metadata without wiping other keys. */
export function withProcessingInMetadata(
  metadata: unknown,
  processing: OrgProcessingSettings,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  base[METADATA_KEY] = processing;
  return base;
}
