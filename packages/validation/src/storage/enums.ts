import { z } from "zod";

/** Registered builtin processor keys (code registry). */
export const ProcessorKey = {
  SECURITY_VIRUS_SCAN: "security.virus_scan",
  IMAGE_NORMALIZE: "image.normalize",
  IMAGE_VARIANTS: "image.variants",
  VIDEO_PREVIEW: "video.preview",
  METADATA_EXIF: "metadata.exif",
  AI_VISION: "ai.vision",
  DEDUPE_PHASH: "dedupe.phash",
  INTEGRITY_VERIFY: "integrity.verify",
  DOCUMENT_PREVIEW: "document.preview",
  DOCUMENT_TEXT: "document.text",
  DOCUMENT_OCR: "document.ocr",
  NOTIFY_WEBHOOK: "notify.webhook",
} as const;

export type ProcessorKey = (typeof ProcessorKey)[keyof typeof ProcessorKey];

export const processorKeySchema = z.string().min(1).max(128);

export const ProcessorKeyLabels: Record<string, string> = {
  [ProcessorKey.SECURITY_VIRUS_SCAN]: "Virus scan",
  [ProcessorKey.IMAGE_NORMALIZE]: "Image normalize",
  [ProcessorKey.IMAGE_VARIANTS]: "Image variants",
  [ProcessorKey.VIDEO_PREVIEW]: "Video preview",
  [ProcessorKey.METADATA_EXIF]: "EXIF metadata",
  [ProcessorKey.AI_VISION]: "AI vision",
  [ProcessorKey.DEDUPE_PHASH]: "Near-duplicate (pHash)",
  [ProcessorKey.INTEGRITY_VERIFY]: "Integrity verify",
  [ProcessorKey.DOCUMENT_PREVIEW]: "Document preview",
  [ProcessorKey.DOCUMENT_TEXT]: "Document text",
  [ProcessorKey.DOCUMENT_OCR]: "Document OCR",
  [ProcessorKey.NOTIFY_WEBHOOK]: "Webhook",
};

export const ProcessorKeyDescriptions: Record<string, string> = {
  [ProcessorKey.SECURITY_VIRUS_SCAN]:
    "Scans stored bytes via ClamAV (clamd). Infected files are quarantined (soft-deleted) and blocked from serve.",
  [ProcessorKey.IMAGE_NORMALIZE]:
    "Normalizes HEIC/HEIF and animated GIF into a stable JPEG still for downstream processors.",
  [ProcessorKey.IMAGE_VARIANTS]:
    "Generates image variants (thumbnail / medium) and fills width/height on the file record.",
  [ProcessorKey.VIDEO_PREVIEW]:
    "Extracts video preview frames/thumbnails and duration.",
  [ProcessorKey.METADATA_EXIF]:
    "Reads EXIF/IPTC/XMP tags into file_processor_results.",
  [ProcessorKey.AI_VISION]:
    "Caption, tags, and NSFW scoring via an OpenAI-compatible vision model (e.g. Ollama).",
  [ProcessorKey.DEDUPE_PHASH]:
    "Computes a perceptual hash and flags visually similar images for review (does not skip storage).",
  [ProcessorKey.INTEGRITY_VERIFY]:
    "Re-hashes stored bytes and compares against the upload SHA-256.",
  [ProcessorKey.DOCUMENT_PREVIEW]:
    "Renders the first page of a PDF as a preview thumbnail.",
  [ProcessorKey.DOCUMENT_TEXT]:
    "Extracts native text from PDFs and text files (no OCR).",
  [ProcessorKey.DOCUMENT_OCR]:
    "OCR for scanned PDFs/images when native text is missing.",
  [ProcessorKey.NOTIFY_WEBHOOK]:
    "POSTs a signed completion payload to the org webhook URL when processing finishes.",
};

export const ProcessorBackendKind = {
  OPENAI_COMPATIBLE: "openai_compatible",
  CLAMAV: "clamav",
  INTERNAL: "internal",
} as const;

export type ProcessorBackendKind =
  (typeof ProcessorBackendKind)[keyof typeof ProcessorBackendKind];

export const processorBackendKindSchema = z.enum([
  ProcessorBackendKind.OPENAI_COMPATIBLE,
  ProcessorBackendKind.CLAMAV,
  ProcessorBackendKind.INTERNAL,
]);

export const ProcessorBackendKindLabels: Record<string, string> = {
  [ProcessorBackendKind.OPENAI_COMPATIBLE]: "OpenAI-compatible (Ollama, etc.)",
  [ProcessorBackendKind.CLAMAV]: "ClamAV (clamd)",
  [ProcessorBackendKind.INTERNAL]: "Internal",
};

export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PARTIAL = "partial",
  SKIPPED = "skipped",
}

export const jobStatusSchema = z.nativeEnum(JobStatus);

export const JobStatusLabels: Record<JobStatus, string> = {
  [JobStatus.PENDING]: "Pending",
  [JobStatus.PROCESSING]: "Processing",
  [JobStatus.COMPLETED]: "Completed",
  [JobStatus.FAILED]: "Failed",
  [JobStatus.CANCELLED]: "Cancelled",
  [JobStatus.PARTIAL]: "Partial",
  [JobStatus.SKIPPED]: "Skipped",
};

export enum ProviderType {
  LOCAL = "local",
  MINIO = "minio",
  S3 = "s3",
}

export const providerTypeSchema = z.nativeEnum(ProviderType);

export const ProviderTypeLabels: Record<ProviderType, string> = {
  [ProviderType.LOCAL]: "Local disk",
  [ProviderType.MINIO]: "MinIO",
  [ProviderType.S3]: "Amazon S3",
};

/** @deprecated Use ProcessorKey instead. Kept for transitional imports. */
export enum JobType {
  IMAGE = "image",
  VIDEO = "video",
  METADATA = "metadata",
  THUMBNAIL = "thumbnail",
  TRANSCODE = "transcode",
}

/** @deprecated */
export const jobTypeSchema = z.nativeEnum(JobType);

/** @deprecated Map legacy job types → processor keys. */
export const legacyJobTypeToProcessorKey: Record<JobType, string> = {
  [JobType.IMAGE]: ProcessorKey.IMAGE_VARIANTS,
  [JobType.VIDEO]: ProcessorKey.VIDEO_PREVIEW,
  [JobType.METADATA]: ProcessorKey.METADATA_EXIF,
  [JobType.THUMBNAIL]: ProcessorKey.IMAGE_VARIANTS,
  [JobType.TRANSCODE]: ProcessorKey.VIDEO_PREVIEW,
};

/** @deprecated */
export const JobTypeLabels: Record<JobType, string> = {
  [JobType.IMAGE]: "Image",
  [JobType.VIDEO]: "Video",
  [JobType.METADATA]: "Metadata",
  [JobType.THUMBNAIL]: "Thumbnail",
  [JobType.TRANSCODE]: "Transcode",
};

/** @deprecated */
export const JobTypeDescriptions: Record<JobType, string> = {
  [JobType.IMAGE]: ProcessorKeyDescriptions[ProcessorKey.IMAGE_VARIANTS]!,
  [JobType.VIDEO]: ProcessorKeyDescriptions[ProcessorKey.VIDEO_PREVIEW]!,
  [JobType.METADATA]: ProcessorKeyDescriptions[ProcessorKey.METADATA_EXIF]!,
  [JobType.THUMBNAIL]: "Standalone thumbnail generation job.",
  [JobType.TRANSCODE]: "Video/audio transcoding job.",
};
