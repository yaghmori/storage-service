import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  BUILTIN_ORG_PROCESSOR_DEFAULTS,
  DEFAULT_AI_VISION_SETTINGS,
  DEFAULT_IMAGE_VARIANTS_SETTINGS,
  DEFAULT_VIDEO_PREVIEW_SETTINGS,
  ProcessorKey,
  aiVisionProcessorSettingsSchema,
  imageVariantsProcessorSettingsSchema,
  videoPreviewProcessorSettingsSchema,
} from '@workspace/validation';
import { and, asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';
import {
  DEFAULT_MIME_INCLUDE,
  mimeMatches,
} from '../constants/processor-keys';
import {
  ImageFormat,
  ImageVariantJobSlot,
  ImageVariantsConfig,
  enabledImageVariantSlots,
  imageSizesFromVariants,
  mergeProcessingSettings,
  normalizeImageVariants,
} from '../types/processing-settings';
import {
  ProcessorCapacityMap,
  emptyCapacityMap,
  extractCapacity,
  normalizeCapacity,
  withCapacity,
} from '../types/processor-capacity';

export type OrgProcessorRow = schema.OrgProcessor;

@Injectable()
export class OrgProcessorsService {
  private readonly logger = new Logger(OrgProcessorsService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async listByOrg(orgId: string): Promise<OrgProcessorRow[]> {
    return this.db
      .select()
      .from(schema.orgProcessors)
      .where(eq(schema.orgProcessors.orgId, orgId))
      .orderBy(asc(schema.orgProcessors.sortOrder));
  }

  async ensureDefaults(orgId: string): Promise<OrgProcessorRow[]> {
    const existing = await this.listByOrg(orgId);
    const existingKeys = new Set(existing.map((r) => r.processorKey));
    const missing = BUILTIN_ORG_PROCESSOR_DEFAULTS.filter(
      (d) => !existingKeys.has(d.processorKey),
    );

    if (existing.length === 0) {
      this.logger.log(`Seeding default org_processors for org ${orgId}`);
      await this.db.insert(schema.orgProcessors).values(
        BUILTIN_ORG_PROCESSOR_DEFAULTS.map((d) => {
          const processorKey = this.requireProcessorKey(d.processorKey);
          return {
            orgId,
            processorKey,
            enabled: d.enabled,
            sortOrder: d.sortOrder,
            mimeInclude: DEFAULT_MIME_INCLUDE[processorKey] ?? null,
            settings: withCapacity(
              { ...(d.settings as Record<string, unknown>) },
              extractCapacity(
                d.settings as Record<string, unknown>,
                processorKey,
              ),
            ),
            backendId: null,
          };
        }),
      );
      return this.listByOrg(orgId);
    }

    if (missing.length > 0) {
      this.logger.log(
        `Seeding ${missing.length} new org_processors for org ${orgId}`,
      );
      await this.db.insert(schema.orgProcessors).values(
        missing.map((d) => {
          const processorKey = this.requireProcessorKey(d.processorKey);
          return {
            orgId,
            processorKey,
            enabled: d.enabled,
            sortOrder: d.sortOrder,
            mimeInclude: DEFAULT_MIME_INCLUDE[processorKey] ?? null,
            settings: withCapacity(
              { ...(d.settings as Record<string, unknown>) },
              extractCapacity(
                d.settings as Record<string, unknown>,
                processorKey,
              ),
            ),
            backendId: null,
          };
        }),
      );
      return this.listByOrg(orgId);
    }

    return existing;
  }

  async getEnabledForFile(
    orgId: string,
    mimeType: string,
  ): Promise<OrgProcessorRow[]> {
    const rows = await this.ensureDefaults(orgId);
    return rows.filter((row) => {
      if (!row.enabled) return false;
      const patterns =
        row.mimeInclude ?? DEFAULT_MIME_INCLUDE[row.processorKey] ?? null;
      return mimeMatches(mimeType, patterns);
    });
  }

  async upsertMany(
    orgId: string,
    processors: Array<{
      processorKey: string;
      enabled: boolean;
      sortOrder?: number;
      mimeInclude?: string[] | null;
      settings?: Record<string, unknown>;
      backendId?: string | null;
    }>,
  ): Promise<OrgProcessorRow[]> {
    await this.ensureDefaults(orgId);

    for (const p of processors) {
      const processorKey = this.requireProcessorKey(p.processorKey);
      const settings = this.normalizeSettings(processorKey, p.settings ?? {});
      const mimeInclude =
        p.mimeInclude === undefined
          ? (DEFAULT_MIME_INCLUDE[processorKey] ?? null)
          : p.mimeInclude;
      const sortOrder = p.sortOrder ?? 0;
      const backendId = await this.resolveOrgBackendId(orgId, p.backendId);

      await this.db
        .insert(schema.orgProcessors)
        .values({
          orgId,
          processorKey,
          enabled: p.enabled,
          sortOrder,
          mimeInclude,
          settings,
          backendId,
        })
        .onConflictDoUpdate({
          target: [
            schema.orgProcessors.orgId,
            schema.orgProcessors.processorKey,
          ],
          set: {
            enabled: p.enabled,
            sortOrder,
            mimeInclude,
            settings,
            backendId,
            updatedAt: new Date(),
          },
        });
    }

    return this.listByOrg(orgId);
  }

  /** Reject assigning a processor backend that belongs to another org. */
  private async resolveOrgBackendId(
    orgId: string,
    backendId: string | null | undefined,
  ): Promise<string | null> {
    if (backendId == null || backendId === '') return null;
    const [row] = await this.db
      .select({ id: schema.processorBackends.id })
      .from(schema.processorBackends)
      .where(
        and(
          eq(schema.processorBackends.id, backendId),
          eq(schema.processorBackends.orgId, orgId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new BadRequestException(
        `Processor backend ${backendId} does not belong to this organization`,
      );
    }
    return row.id;
  }

  private requireProcessorKey(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `org_processors upsert missing processorKey (got ${String(value)}). ` +
          'Rebuild @workspace/validation (`pnpm --filter @workspace/validation build`) and restart the API.',
      );
    }
    return value.trim();
  }

  /** Convenience for image worker: resolve variant slots from org_processors. */
  getImageVariantSlots(settings: Record<string, unknown>): {
    variants: ImageVariantJobSlot[];
    formats: ImageFormat[];
    imageVariants: ImageVariantsConfig;
  } {
    const parsed = imageVariantsProcessorSettingsSchema.safeParse(settings);
    // Defaults first, persisted values second — later layers win.
    const merged = mergeProcessingSettings(
      {
        enableImageProcessing: true,
        ...DEFAULT_IMAGE_VARIANTS_SETTINGS,
      },
      {
        enableImageProcessing: true,
        imageVariants: parsed.success
          ? (parsed.data.imageVariants as ImageVariantsConfig | undefined)
          : undefined,
        imageFormats: parsed.success ? parsed.data.imageFormats : undefined,
      },
    );
    const normalized = normalizeImageVariants(
      merged.imageVariants,
      true,
    );
    return {
      variants: enabledImageVariantSlots({ imageVariants: normalized }),
      formats: merged.imageFormats,
      imageVariants: normalized,
    };
  }

  getVideoOptions(settings: Record<string, unknown>): {
    previewFrames: number;
    thumbnail: boolean;
  } {
    const parsed = videoPreviewProcessorSettingsSchema.safeParse(settings);
    return {
      previewFrames:
        parsed.success && parsed.data.videoPreviewFrames !== undefined
          ? parsed.data.videoPreviewFrames
          : DEFAULT_VIDEO_PREVIEW_SETTINGS.videoPreviewFrames,
      thumbnail:
        parsed.success && parsed.data.videoThumbnail !== undefined
          ? parsed.data.videoThumbnail
          : DEFAULT_VIDEO_PREVIEW_SETTINGS.videoThumbnail,
    };
  }

  getAiVisionSettings(settings: Record<string, unknown>) {
    const parsed = aiVisionProcessorSettingsSchema.safeParse(settings);
    return {
      ...DEFAULT_AI_VISION_SETTINGS,
      ...(parsed.success ? parsed.data : {}),
    };
  }

  /**
   * Admin form compatibility: flatten org_processors into the legacy
   * processing-settings shape used by the existing UI.
   */
  toLegacyProcessingSettings(rows: OrgProcessorRow[]) {
    const byKey = new Map(rows.map((r) => [r.processorKey, r]));
    // Prefer string keys so a stale @workspace/validation build (missing new
    // ProcessorKey entries) cannot silently map every new processor to defaults.
    const image = byKey.get('image.variants') ?? byKey.get(ProcessorKey.IMAGE_VARIANTS);
    const video = byKey.get('video.preview') ?? byKey.get(ProcessorKey.VIDEO_PREVIEW);
    const meta = byKey.get('metadata.exif') ?? byKey.get(ProcessorKey.METADATA_EXIF);
    const ai = byKey.get('ai.vision') ?? byKey.get(ProcessorKey.AI_VISION);
    const normalize =
      byKey.get('image.normalize') ?? byKey.get(ProcessorKey.IMAGE_NORMALIZE);
    const phash = byKey.get('dedupe.phash') ?? byKey.get(ProcessorKey.DEDUPE_PHASH);
    const integrity =
      byKey.get('integrity.verify') ?? byKey.get(ProcessorKey.INTEGRITY_VERIFY);
    const virusScan =
      byKey.get('security.virus_scan') ??
      byKey.get(ProcessorKey.SECURITY_VIRUS_SCAN);
    const docPreview =
      byKey.get('document.preview') ?? byKey.get(ProcessorKey.DOCUMENT_PREVIEW);
    const docText =
      byKey.get('document.text') ?? byKey.get(ProcessorKey.DOCUMENT_TEXT);
    const docOcr =
      byKey.get('document.ocr') ?? byKey.get(ProcessorKey.DOCUMENT_OCR);
    const notify =
      byKey.get('notify.webhook') ?? byKey.get(ProcessorKey.NOTIFY_WEBHOOK);

    const imageSettings = this.getImageVariantSlots(
      (image?.settings ?? {}) as Record<string, unknown>,
    );
    const videoSettings = this.getVideoOptions(
      (video?.settings ?? {}) as Record<string, unknown>,
    );
    const aiSettings = this.getAiVisionSettings(
      (ai?.settings ?? {}) as Record<string, unknown>,
    );
    const phashSettings = (phash?.settings ?? {}) as { thresholdBits?: number };
    const docOcrSettings = (docOcr?.settings ?? {}) as {
      engine?: 'openai_compatible' | 'tesseract';
      models?: { vision?: string };
    };
    const notifySettings = (notify?.settings ?? {}) as {
      url?: string;
      secret?: string;
    };
    // Keep disabled slots' maxEdge from saved settings (not only enabled job slots).
    const variants = normalizeImageVariants(
      imageSettings.imageVariants,
      image?.enabled ?? true,
    );

    return {
      enableImageProcessing: image?.enabled ?? true,
      enableVideoProcessing: video?.enabled ?? true,
      enableMetadataExtraction: meta?.enabled ?? true,
      enableAiProcessing: ai?.enabled ?? false,
      enableAiCaption: aiSettings.enableCaption ?? true,
      enableAiTags: aiSettings.enableTags ?? true,
      enableAiNsfw: aiSettings.enableNsfw ?? true,
      nsfwThreshold: aiSettings.nsfwThreshold ?? 0.7,
      aiBackendId: ai?.backendId ?? null,
      aiVisionModel: aiSettings.models?.vision?.trim() || null,
      documentOcrBackendId: docOcr?.backendId ?? null,
      documentOcrVisionModel: docOcrSettings.models?.vision?.trim() || null,
      imageVariants: variants,
      imageSizes: imageSizesFromVariants(variants),
      imageFormats: imageSettings.formats,
      videoThumbnail: videoSettings.thumbnail,
      videoPreviewFrames: videoSettings.previewFrames,
      enableImageNormalize: normalize?.enabled ?? true,
      enableDedupePhash: phash?.enabled ?? false,
      phashThresholdBits: phashSettings.thresholdBits ?? 10,
      enableIntegrityVerify: integrity?.enabled ?? false,
      enableVirusScan: virusScan?.enabled ?? false,
      virusScanBackendId: virusScan?.backendId ?? null,
      enableDocumentPreview: docPreview?.enabled ?? true,
      enableDocumentText: docText?.enabled ?? true,
      enableDocumentOcr: docOcr?.enabled ?? false,
      documentOcrEngine: (docOcrSettings.engine === 'tesseract'
        ? 'tesseract'
        : 'openai_compatible') as 'openai_compatible' | 'tesseract',
      enableNotifyWebhook: notify?.enabled ?? false,
      notifyWebhookUrl: notifySettings.url ?? '',
      notifyWebhookSecret: notifySettings.secret ?? '',
      processorCapacity: this.capacityMapFromRows(rows),
    };
  }

  capacityMapFromRows(rows: OrgProcessorRow[]): ProcessorCapacityMap {
    const map = emptyCapacityMap();
    for (const row of rows) {
      map[row.processorKey] = extractCapacity(
        (row.settings ?? {}) as Record<string, unknown>,
        row.processorKey,
      );
    }
    return map;
  }

  async getCapacity(
    orgId: string,
    processorKey: string,
  ): Promise<ReturnType<typeof extractCapacity>> {
    const rows = await this.ensureDefaults(orgId);
    const row = rows.find((r) => r.processorKey === processorKey);
    return extractCapacity(
      (row?.settings ?? {}) as Record<string, unknown>,
      processorKey,
    );
  }

  async updateFromLegacySettings(
    orgId: string,
    body: Record<string, unknown>,
  ): Promise<ReturnType<OrgProcessorsService['toLegacyProcessingSettings']>> {
    const current = await this.ensureDefaults(orgId);
    const legacy = this.toLegacyProcessingSettings(current);

    const enableImage =
      typeof body.enableImageProcessing === 'boolean'
        ? body.enableImageProcessing
        : legacy.enableImageProcessing;
    const enableVideo =
      typeof body.enableVideoProcessing === 'boolean'
        ? body.enableVideoProcessing
        : legacy.enableVideoProcessing;
    const enableMeta =
      typeof body.enableMetadataExtraction === 'boolean'
        ? body.enableMetadataExtraction
        : legacy.enableMetadataExtraction;
    const enableAi =
      typeof body.enableAiProcessing === 'boolean'
        ? body.enableAiProcessing
        : legacy.enableAiProcessing;

    const bodyVariants = coerceImageVariants(body.imageVariants);
    const imageVariants = normalizeImageVariants(
      bodyVariants ??
        mergeProcessingSettings(
          {
            enableImageProcessing: enableImage,
            imageVariants: legacy.imageVariants,
            imageFormats: legacy.imageFormats,
          },
          {
            enableImageProcessing: enableImage,
            imageFormats: body.imageFormats as ImageFormat[] | undefined,
            imageSizes: Array.isArray(body.imageSizes)
              ? (body.imageSizes as number[])
              : undefined,
          },
        ).imageVariants,
      enableImage,
    );
    const imageFormats =
      (body.imageFormats as ImageFormat[] | undefined) ?? legacy.imageFormats;

    const capacityIncoming =
      body.processorCapacity && typeof body.processorCapacity === 'object'
        ? (body.processorCapacity as Record<string, Partial<{
            concurrency: number;
            rateMax: number | null;
            rateDurationMs: number | null;
          }>>)
        : {};
    const capacityFor = (processorKey: string) =>
      normalizeCapacity(
        capacityIncoming[processorKey] ??
          (legacy as { processorCapacity?: ProcessorCapacityMap })
            .processorCapacity?.[processorKey],
        processorKey,
      );

    // String literals avoid undefined keys if a stale @workspace/validation
    // build is still loaded in a long-lived API process.
    await this.upsertMany(orgId, [
      {
        processorKey: 'security.virus_scan',
        enabled:
          typeof body.enableVirusScan === 'boolean'
            ? body.enableVirusScan
            : (legacy as { enableVirusScan?: boolean }).enableVirusScan ??
              false,
        sortOrder: 1,
        backendId:
          body.virusScanBackendId === undefined
            ? (legacy as { virusScanBackendId?: string | null })
                .virusScanBackendId ?? null
            : (body.virusScanBackendId as string | null),
        settings: withCapacity({}, capacityFor('security.virus_scan')),
      },
      {
        processorKey: 'image.normalize',
        enabled:
          typeof body.enableImageNormalize === 'boolean'
            ? body.enableImageNormalize
            : (legacy as { enableImageNormalize?: boolean }).enableImageNormalize ??
              true,
        sortOrder: 5,
        settings: withCapacity(
          { forceAllImages: false, maxEdge: 2048 },
          capacityFor('image.normalize'),
        ),
      },
      {
        processorKey: 'image.variants',
        enabled: enableImage,
        sortOrder: 10,
        settings: withCapacity(
          { imageVariants, imageFormats },
          capacityFor('image.variants'),
        ),
      },
      {
        processorKey: 'video.preview',
        enabled: enableVideo,
        sortOrder: 20,
        settings: withCapacity(
          {
            videoThumbnail:
              typeof body.videoThumbnail === 'boolean'
                ? body.videoThumbnail
                : legacy.videoThumbnail,
            videoPreviewFrames:
              typeof body.videoPreviewFrames === 'number'
                ? body.videoPreviewFrames
                : legacy.videoPreviewFrames,
          },
          capacityFor('video.preview'),
        ),
      },
      {
        processorKey: 'metadata.exif',
        enabled: enableMeta,
        sortOrder: 30,
        settings: withCapacity({}, capacityFor('metadata.exif')),
      },
      {
        processorKey: 'ai.vision',
        enabled: enableAi,
        sortOrder: 40,
        backendId:
          body.aiBackendId === undefined
            ? legacy.aiBackendId
            : (body.aiBackendId as string | null),
        settings: withCapacity(
          {
            enableCaption:
              typeof body.enableAiCaption === 'boolean'
                ? body.enableAiCaption
                : legacy.enableAiCaption,
            enableTags:
              typeof body.enableAiTags === 'boolean'
                ? body.enableAiTags
                : legacy.enableAiTags,
            enableNsfw:
              typeof body.enableAiNsfw === 'boolean'
                ? body.enableAiNsfw
                : legacy.enableAiNsfw,
            nsfwThreshold:
              typeof body.nsfwThreshold === 'number'
                ? body.nsfwThreshold
                : legacy.nsfwThreshold,
            models: {
              vision:
                body.aiVisionModel === undefined
                  ? (legacy as { aiVisionModel?: string | null }).aiVisionModel ||
                    undefined
                  : typeof body.aiVisionModel === 'string'
                    ? body.aiVisionModel.trim() || undefined
                    : undefined,
            },
          },
          capacityFor('ai.vision'),
        ),
      },
      {
        processorKey: 'dedupe.phash',
        enabled:
          typeof body.enableDedupePhash === 'boolean'
            ? body.enableDedupePhash
            : (legacy as { enableDedupePhash?: boolean }).enableDedupePhash ??
              false,
        sortOrder: 45,
        settings: withCapacity(
          {
            thresholdBits:
              typeof body.phashThresholdBits === 'number'
                ? body.phashThresholdBits
                : (legacy as { phashThresholdBits?: number }).phashThresholdBits ??
                  10,
          },
          capacityFor('dedupe.phash'),
        ),
      },
      {
        processorKey: 'integrity.verify',
        enabled:
          typeof body.enableIntegrityVerify === 'boolean'
            ? body.enableIntegrityVerify
            : (legacy as { enableIntegrityVerify?: boolean })
                .enableIntegrityVerify ?? false,
        sortOrder: 50,
        settings: withCapacity({}, capacityFor('integrity.verify')),
      },
      {
        processorKey: 'document.preview',
        enabled:
          typeof body.enableDocumentPreview === 'boolean'
            ? body.enableDocumentPreview
            : (legacy as { enableDocumentPreview?: boolean })
                .enableDocumentPreview ?? true,
        sortOrder: 60,
        settings: withCapacity(
          { maxEdge: 800 },
          capacityFor('document.preview'),
        ),
      },
      {
        processorKey: 'document.text',
        enabled:
          typeof body.enableDocumentText === 'boolean'
            ? body.enableDocumentText
            : (legacy as { enableDocumentText?: boolean }).enableDocumentText ??
              true,
        sortOrder: 70,
        settings: withCapacity(
          { maxChars: 524_288 },
          capacityFor('document.text'),
        ),
      },
      {
        processorKey: 'document.ocr',
        enabled:
          typeof body.enableDocumentOcr === 'boolean'
            ? body.enableDocumentOcr
            : (legacy as { enableDocumentOcr?: boolean }).enableDocumentOcr ??
              false,
        sortOrder: 80,
        backendId:
          body.documentOcrBackendId === undefined
            ? legacy.documentOcrBackendId
            : (body.documentOcrBackendId as string | null),
        settings: withCapacity(
          {
            minCharsBeforeSkip: 40,
            engine:
              typeof body.documentOcrEngine === 'string'
                ? body.documentOcrEngine === 'tesseract'
                  ? 'tesseract'
                  : 'openai_compatible'
                : (legacy as { documentOcrEngine?: string }).documentOcrEngine ===
                    'tesseract'
                  ? 'tesseract'
                  : 'openai_compatible',
            models: {
              vision:
                body.documentOcrVisionModel === undefined
                  ? (
                      legacy as { documentOcrVisionModel?: string | null }
                    ).documentOcrVisionModel || undefined
                  : typeof body.documentOcrVisionModel === 'string'
                    ? body.documentOcrVisionModel.trim() || undefined
                    : undefined,
            },
          },
          capacityFor('document.ocr'),
        ),
      },
      {
        processorKey: 'notify.webhook',
        enabled:
          typeof body.enableNotifyWebhook === 'boolean'
            ? body.enableNotifyWebhook
            : (legacy as { enableNotifyWebhook?: boolean })
                .enableNotifyWebhook ?? false,
        sortOrder: 100,
        settings: withCapacity(
          {
            url:
              typeof body.notifyWebhookUrl === 'string'
                ? body.notifyWebhookUrl
                : (legacy as { notifyWebhookUrl?: string }).notifyWebhookUrl ?? '',
            secret:
              typeof body.notifyWebhookSecret === 'string'
                ? body.notifyWebhookSecret
                : (legacy as { notifyWebhookSecret?: string })
                    .notifyWebhookSecret ?? '',
            events: [
              'processing.completed',
              'processing.failed',
              'processing.partial',
            ],
          },
          capacityFor('notify.webhook'),
        ),
      },
    ]);

    const rows = await this.listByOrg(orgId);
    return this.toLegacyProcessingSettings(rows);
  }

  private normalizeSettings(
    processorKey: string,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const capacity = extractCapacity(settings, processorKey);
    // Use string literals so a stale ProcessorKey export cannot skip validation.
    if (processorKey === 'image.variants') {
      const parsed = imageVariantsProcessorSettingsSchema.safeParse(settings);
      if (parsed.success) return withCapacity(parsed.data, capacity);
      this.logger.warn(
        `image.variants settings failed schema parse; merging with defaults. keys=${Object.keys(settings).join(',')}`,
      );
      return withCapacity(
        {
          ...DEFAULT_IMAGE_VARIANTS_SETTINGS,
          ...settings,
          imageVariants:
            coerceImageVariants(settings.imageVariants) ??
            DEFAULT_IMAGE_VARIANTS_SETTINGS.imageVariants,
          imageFormats: Array.isArray(settings.imageFormats)
            ? settings.imageFormats
            : DEFAULT_IMAGE_VARIANTS_SETTINGS.imageFormats,
        },
        capacity,
      );
    }
    if (processorKey === 'video.preview') {
      const parsed = videoPreviewProcessorSettingsSchema.safeParse(settings);
      return withCapacity(
        parsed.success
          ? parsed.data
          : { ...DEFAULT_VIDEO_PREVIEW_SETTINGS, ...settings },
        capacity,
      );
    }
    if (processorKey === 'ai.vision') {
      const parsed = aiVisionProcessorSettingsSchema.safeParse(settings);
      return withCapacity(
        parsed.success
          ? parsed.data
          : { ...DEFAULT_AI_VISION_SETTINGS, ...settings },
        capacity,
      );
    }
    return withCapacity(settings, capacity);
  }
}

function coerceImageVariants(raw: unknown): ImageVariantsConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;
  const thumb = root.thumbnail;
  const medium = root.medium;
  if (!thumb || typeof thumb !== 'object' || !medium || typeof medium !== 'object') {
    return null;
  }
  const t = thumb as Record<string, unknown>;
  const m = medium as Record<string, unknown>;
  const thumbEdge = Number(t.maxEdge);
  const mediumEdge = Number(m.maxEdge);
  if (!Number.isFinite(thumbEdge) || !Number.isFinite(mediumEdge)) return null;
  return {
    thumbnail: {
      enabled: t.enabled !== false,
      maxEdge: Math.floor(thumbEdge),
    },
    medium: {
      enabled: m.enabled !== false,
      maxEdge: Math.floor(mediumEdge),
    },
  };
}
