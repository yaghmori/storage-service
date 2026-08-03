import { z } from "zod";
import { ProcessorBackendKind, ProcessorKey } from "../storage/enums";

const optionalTrimmed = z.string().trim();

export const openaiCompatibleBackendConfigSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .min(1, "Base URL is required")
    .max(500, "Base URL is too long")
    .refine((v) => /^https?:\/\//i.test(v), {
      message: "Base URL must start with http:// or https://",
    }),
  /** Ciphertext stored server-side; never returned plaintext. */
  apiKeyEncrypted: z.string().optional(),
  apiKeyLast4: z.string().max(4).optional(),
  defaultModels: z
    .object({
      vision: optionalTrimmed.max(255).optional(),
      text: optionalTrimmed.max(255).optional(),
    })
    .optional(),
  timeoutMs: z.number().int().min(1_000).max(600_000).optional(),
});

export type OpenaiCompatibleBackendConfig = z.infer<
  typeof openaiCompatibleBackendConfigSchema
>;

/** Admin create/update input — plaintext apiKey is write-only. */
export const processorBackendFormSchema = z.object({
  name: z.string().trim().min(1).max(255),
  kind: z.literal(ProcessorBackendKind.OPENAI_COMPATIBLE),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  baseUrl: z
    .string()
    .trim()
    .min(1, "Base URL is required")
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), {
      message: "Base URL must start with http:// or https://",
    }),
  apiKey: z.string().max(512).optional().or(z.literal("")),
  clearApiKey: z.boolean().optional(),
  visionModel: optionalTrimmed.max(255).optional().or(z.literal("")),
  textModel: optionalTrimmed.max(255).optional().or(z.literal("")),
  timeoutMs: z.number().int().min(1_000).max(600_000).optional(),
});

export type ProcessorBackendFormValues = z.infer<
  typeof processorBackendFormSchema
>;

export const imageVariantSlotSchema = z.object({
  enabled: z.boolean(),
  maxEdge: z.number().int().min(1).max(4096),
});

export const imageVariantsSettingsSchema = z.object({
  thumbnail: imageVariantSlotSchema,
  medium: imageVariantSlotSchema,
});

export const imageVariantsProcessorSettingsSchema = z.object({
  imageVariants: imageVariantsSettingsSchema.optional(),
  imageFormats: z.array(z.enum(["webp", "avif"])).optional(),
});

export const videoPreviewProcessorSettingsSchema = z.object({
  videoThumbnail: z.boolean().optional(),
  videoPreviewFrames: z.number().int().min(0).max(30).optional(),
});

export const metadataExifProcessorSettingsSchema = z.object({}).passthrough();

export const aiVisionProcessorSettingsSchema = z.object({
  enableCaption: z.boolean().optional(),
  enableTags: z.boolean().optional(),
  enableNsfw: z.boolean().optional(),
  nsfwThreshold: z.number().min(0).max(1).optional(),
  models: z
    .object({
      vision: optionalTrimmed.max(255).optional(),
    })
    .optional(),
});

export type AiVisionProcessorSettings = z.infer<
  typeof aiVisionProcessorSettingsSchema
>;

export const imageNormalizeProcessorSettingsSchema = z.object({
  forceAllImages: z.boolean().optional(),
  maxEdge: z.number().int().min(64).max(4096).optional(),
});

export const dedupePhashProcessorSettingsSchema = z.object({
  thresholdBits: z.number().int().min(0).max(64).optional(),
});

export const integrityVerifyProcessorSettingsSchema = z.object({}).passthrough();

export const documentPreviewProcessorSettingsSchema = z.object({
  maxEdge: z.number().int().min(64).max(2048).optional(),
});

export const documentTextProcessorSettingsSchema = z.object({
  maxChars: z.number().int().min(1_000).max(2_000_000).optional(),
});

export const documentOcrProcessorSettingsSchema = z.object({
  minCharsBeforeSkip: z.number().int().min(0).max(10_000).optional(),
  engine: z.enum(["openai_compatible", "tesseract"]).optional(),
  models: z
    .object({
      vision: optionalTrimmed.max(255).optional(),
    })
    .optional(),
});

export const notifyWebhookProcessorSettingsSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .optional()
    .or(z.literal("")),
  secret: z.string().max(512).optional().or(z.literal("")),
  events: z
    .array(z.enum(["processing.completed", "processing.failed", "processing.partial"]))
    .optional(),
});

export type NotifyWebhookProcessorSettings = z.infer<
  typeof notifyWebhookProcessorSettingsSchema
>;

export const orgProcessorUpsertSchema = z.object({
  processorKey: z.string().min(1).max(128),
  enabled: z.boolean(),
  sortOrder: z.number().int().optional(),
  mimeInclude: z.array(z.string()).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  backendId: z.string().uuid().nullable().optional(),
});

export const orgProcessorsBulkUpdateSchema = z.object({
  processors: z.array(orgProcessorUpsertSchema).min(1),
});

export const DEFAULT_IMAGE_VARIANTS_SETTINGS = {
  imageVariants: {
    thumbnail: { enabled: true, maxEdge: 200 },
    medium: { enabled: true, maxEdge: 800 },
  },
  imageFormats: ["webp"] as ("webp" | "avif")[],
};

export const DEFAULT_VIDEO_PREVIEW_SETTINGS = {
  videoThumbnail: true,
  videoPreviewFrames: 3,
};

export const DEFAULT_AI_VISION_SETTINGS: AiVisionProcessorSettings = {
  enableCaption: true,
  enableTags: true,
  enableNsfw: true,
  nsfwThreshold: 0.7,
};

export const DEFAULT_IMAGE_NORMALIZE_SETTINGS = {
  forceAllImages: false,
  maxEdge: 2048,
};

export const DEFAULT_DEDUPE_PHASH_SETTINGS = {
  thresholdBits: 10,
};

export const DEFAULT_DOCUMENT_PREVIEW_SETTINGS = {
  maxEdge: 800,
};

export const DEFAULT_DOCUMENT_TEXT_SETTINGS = {
  maxChars: 524_288,
};

export const DEFAULT_DOCUMENT_OCR_SETTINGS = {
  minCharsBeforeSkip: 40,
  engine: "openai_compatible" as const,
};

export const DEFAULT_NOTIFY_WEBHOOK_SETTINGS: NotifyWebhookProcessorSettings = {
  url: "",
  secret: "",
  events: ["processing.completed", "processing.failed", "processing.partial"],
};

export const BUILTIN_ORG_PROCESSOR_DEFAULTS: Array<{
  processorKey: string;
  enabled: boolean;
  sortOrder: number;
  settings: Record<string, unknown>;
}> = [
  {
    processorKey: ProcessorKey.IMAGE_NORMALIZE,
    enabled: true,
    sortOrder: 5,
    settings: DEFAULT_IMAGE_NORMALIZE_SETTINGS,
  },
  {
    processorKey: ProcessorKey.IMAGE_VARIANTS,
    enabled: true,
    sortOrder: 10,
    settings: DEFAULT_IMAGE_VARIANTS_SETTINGS,
  },
  {
    processorKey: ProcessorKey.VIDEO_PREVIEW,
    enabled: true,
    sortOrder: 20,
    settings: DEFAULT_VIDEO_PREVIEW_SETTINGS,
  },
  {
    processorKey: ProcessorKey.METADATA_EXIF,
    enabled: true,
    sortOrder: 30,
    settings: {},
  },
  {
    processorKey: ProcessorKey.AI_VISION,
    enabled: false,
    sortOrder: 40,
    settings: DEFAULT_AI_VISION_SETTINGS,
  },
  {
    processorKey: ProcessorKey.DEDUPE_PHASH,
    enabled: false,
    sortOrder: 45,
    settings: DEFAULT_DEDUPE_PHASH_SETTINGS,
  },
  {
    processorKey: ProcessorKey.INTEGRITY_VERIFY,
    enabled: false,
    sortOrder: 50,
    settings: {},
  },
  {
    processorKey: ProcessorKey.DOCUMENT_PREVIEW,
    enabled: true,
    sortOrder: 60,
    settings: DEFAULT_DOCUMENT_PREVIEW_SETTINGS,
  },
  {
    processorKey: ProcessorKey.DOCUMENT_TEXT,
    enabled: true,
    sortOrder: 70,
    settings: DEFAULT_DOCUMENT_TEXT_SETTINGS,
  },
  {
    processorKey: ProcessorKey.DOCUMENT_OCR,
    enabled: false,
    sortOrder: 80,
    settings: DEFAULT_DOCUMENT_OCR_SETTINGS,
  },
  {
    processorKey: ProcessorKey.NOTIFY_WEBHOOK,
    enabled: false,
    sortOrder: 100,
    settings: DEFAULT_NOTIFY_WEBHOOK_SETTINGS,
  },
];

export const aiVisionResultDataSchema = z.object({
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  nsfwScore: z.number().min(0).max(1).nullable().optional(),
  isNsfw: z.boolean().optional(),
});
