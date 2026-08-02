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
  imageVariants: {
    thumbnail: { enabled: true, maxEdge: 200 },
    medium: { enabled: true, maxEdge: 800 },
  },
  imageSizes: [200, 800],
  imageFormats: ['webp'],
  videoThumbnail: true,
  videoPreviewFrames: 3,
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
