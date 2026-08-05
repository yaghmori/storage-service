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
  timeoutMs: z
    .number({ error: "Timeout must be a number" })
    .int("Timeout must be a whole number")
    .min(1_000, "Timeout must be at least 1,000 ms")
    .max(600_000, "Timeout must not exceed 600,000 ms")
    .optional(),
});

export type OpenaiCompatibleBackendConfig = z.infer<
  typeof openaiCompatibleBackendConfigSchema
>;

/** Admin create/update input — plaintext apiKey is write-only. */
export const processorBackendFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(255, "Name must not exceed 255 characters"),
    kind: z.enum([
      ProcessorBackendKind.OPENAI_COMPATIBLE,
      ProcessorBackendKind.CLAMAV,
    ]),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
    baseUrl: z
      .string()
      .trim()
      .min(1, "Host / URL is required")
      .max(500, "Host / URL must not exceed 500 characters"),
    apiKey: z
      .string()
      .max(512, "API key must not exceed 512 characters")
      .optional()
      .or(z.literal("")),
    clearApiKey: z.boolean().optional(),
    visionModel: optionalTrimmed
      .max(255, "Vision model must not exceed 255 characters")
      .optional()
      .or(z.literal("")),
    textModel: optionalTrimmed
      .max(255, "Text model must not exceed 255 characters")
      .optional()
      .or(z.literal("")),
    timeoutMs: z
      .number({ error: "Timeout must be a number" })
      .int("Timeout must be a whole number")
      .min(1_000, "Timeout must be at least 1,000 ms")
      .max(600_000, "Timeout must not exceed 600,000 ms")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === ProcessorBackendKind.OPENAI_COMPATIBLE) {
      if (!/^https?:\/\//i.test(value.baseUrl)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseUrl"],
          message: "Base URL must start with http:// or https://",
        });
      }
    } else if (value.kind === ProcessorBackendKind.CLAMAV) {
      if (value.baseUrl.indexOf(":") < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseUrl"],
          message: "Clamd host must be host:port (e.g. clamav:3310)",
        });
      }
    }
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

export const DEFAULT_AI_VISION_SYSTEM_PROMPT = `You are a vision analysis assistant for a file storage service.
Respond with a single JSON object only (no markdown) using this shape:
{
  "description": "concise caption of the image",
  "tags": ["short", "tags"],
  "nsfwScore": 0.0,
  "isNsfw": false
}
nsfwScore must be between 0 and 1. isNsfw should be true when the image is sexually explicit or pornographic.`;

export const DEFAULT_DOCUMENT_OCR_SYSTEM_PROMPT =
  'Extract all visible text from the image exactly as written. If there is no readable text, return {"text":""}. Return only JSON: {"text":"..."}';

export const DEFAULT_DOCUMENT_OCR_USER_PROMPT =
  "OCR this image. Extract every readable character.";

/** Default user instruction when caption/tags/NSFW are all enabled. */
export const DEFAULT_AI_VISION_USER_PROMPT =
  "Analyze this image. Include description. Include tags (3-10). Include nsfwScore and isNsfw.";

export const aiVisionProcessorSettingsSchema = z.object({
  enableCaption: z.boolean().optional(),
  enableTags: z.boolean().optional(),
  enableNsfw: z.boolean().optional(),
  nsfwThreshold: z.number().min(0).max(1).optional(),
  /** Override system prompt sent to the vision model. Empty = built-in default. */
  systemPrompt: z.string().max(8_000).optional(),
  /** Override user text prompt. Empty = auto-built from caption/tags/NSFW toggles. */
  userPrompt: z.string().max(4_000).optional(),
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
  /** Tesseract `-l` language codes, e.g. `eng` or `eng+fas`. Ignored for OpenAI OCR. */
  tesseractLang: optionalTrimmed.max(64).optional(),
  /** Override system prompt for OpenAI-compatible OCR. Empty = built-in default. */
  systemPrompt: z.string().max(8_000).optional(),
  /** Override user prompt for OpenAI-compatible OCR. Empty = built-in default. */
  userPrompt: z.string().max(4_000).optional(),
  models: z
    .object({
      vision: optionalTrimmed.max(255).optional(),
    })
    .optional(),
});

export type DocumentOcrProcessorSettings = z.infer<
  typeof documentOcrProcessorSettingsSchema
>;

export const NOTIFY_WEBHOOK_EVENTS = [
  "processing.completed",
  "processing.failed",
  "processing.partial",
] as const;

export type NotifyWebhookEvent = (typeof NOTIFY_WEBHOOK_EVENTS)[number];

export const notifyWebhookHeaderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Header name is required")
    .max(128)
    .regex(/^[A-Za-z0-9-]+$/, "Header name must be alphanumeric or hyphen"),
  value: z.string().max(2_048),
});

export const notifyWebhookProcessorSettingsSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .optional()
    .or(z.literal("")),
  secret: z.string().max(512).optional().or(z.literal("")),
  /** Optional Bearer token → Authorization: Bearer … */
  bearerToken: z.string().max(2_048).optional().or(z.literal("")),
  /** Extra HTTP headers (e.g. for n8n / API gateways). */
  headers: z.array(notifyWebhookHeaderSchema).max(20).optional(),
  events: z.array(z.enum(NOTIFY_WEBHOOK_EVENTS)).optional(),
  /** Include a short-lived signed download URL in the payload (default true). */
  includeDownloadUrl: z.boolean().optional(),
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
  systemPrompt: DEFAULT_AI_VISION_SYSTEM_PROMPT,
  userPrompt: DEFAULT_AI_VISION_USER_PROMPT,
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

export const DEFAULT_DOCUMENT_OCR_SETTINGS: DocumentOcrProcessorSettings = {
  minCharsBeforeSkip: 40,
  engine: "openai_compatible",
  tesseractLang: "eng",
  systemPrompt: DEFAULT_DOCUMENT_OCR_SYSTEM_PROMPT,
  userPrompt: DEFAULT_DOCUMENT_OCR_USER_PROMPT,
};

export const DEFAULT_NOTIFY_WEBHOOK_SETTINGS: NotifyWebhookProcessorSettings = {
  url: "",
  secret: "",
  bearerToken: "",
  headers: [],
  events: ["processing.completed", "processing.failed", "processing.partial"],
  includeDownloadUrl: true,
};

export const BUILTIN_ORG_PROCESSOR_DEFAULTS: Array<{
  processorKey: string;
  enabled: boolean;
  sortOrder: number;
  settings: Record<string, unknown>;
}> = [
  {
    processorKey: ProcessorKey.SECURITY_VIRUS_SCAN,
    enabled: false,
    sortOrder: 1,
    settings: {},
  },
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
