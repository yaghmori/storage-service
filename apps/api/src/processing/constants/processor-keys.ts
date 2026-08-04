import {
  BUILTIN_ORG_PROCESSOR_DEFAULTS,
  ProcessorKey,
} from '@workspace/validation';

export { BUILTIN_ORG_PROCESSOR_DEFAULTS, ProcessorKey };

export const PROCESSOR_QUEUE_BY_KEY: Record<string, string> = {
  [ProcessorKey.SECURITY_VIRUS_SCAN]: 'virus-scan',
  [ProcessorKey.IMAGE_NORMALIZE]: 'image-normalize',
  [ProcessorKey.IMAGE_VARIANTS]: 'image-processing',
  [ProcessorKey.VIDEO_PREVIEW]: 'video-processing',
  [ProcessorKey.METADATA_EXIF]: 'metadata-extraction',
  [ProcessorKey.AI_VISION]: 'ai-vision',
  [ProcessorKey.DEDUPE_PHASH]: 'dedupe-phash',
  [ProcessorKey.INTEGRITY_VERIFY]: 'integrity-verify',
  [ProcessorKey.DOCUMENT_PREVIEW]: 'document-preview',
  [ProcessorKey.DOCUMENT_TEXT]: 'document-text',
  [ProcessorKey.DOCUMENT_OCR]: 'document-ocr',
  [ProcessorKey.NOTIFY_WEBHOOK]: 'notify-webhook',
};

export const DEFAULT_MIME_INCLUDE: Record<string, string[] | null> = {
  [ProcessorKey.SECURITY_VIRUS_SCAN]: null,
  [ProcessorKey.IMAGE_NORMALIZE]: ['image/heic', 'image/heif', 'image/gif'],
  [ProcessorKey.IMAGE_VARIANTS]: ['image/*'],
  [ProcessorKey.VIDEO_PREVIEW]: ['video/*'],
  [ProcessorKey.METADATA_EXIF]: null,
  [ProcessorKey.AI_VISION]: ['image/*'],
  [ProcessorKey.DEDUPE_PHASH]: ['image/*'],
  [ProcessorKey.INTEGRITY_VERIFY]: null,
  [ProcessorKey.DOCUMENT_PREVIEW]: ['application/pdf'],
  [ProcessorKey.DOCUMENT_TEXT]: ['application/pdf', 'text/*'],
  [ProcessorKey.DOCUMENT_OCR]: ['application/pdf', 'image/*'],
  [ProcessorKey.NOTIFY_WEBHOOK]: null,
};

export function mimeMatches(
  mimeType: string,
  patterns: string[] | null | undefined,
): boolean {
  if (!patterns || patterns.length === 0) return true;
  const mime = mimeType.toLowerCase();
  return patterns.some((pattern) => {
    const p = pattern.toLowerCase().trim();
    if (!p) return false;
    if (p.endsWith('/*')) {
      return mime.startsWith(p.slice(0, -1));
    }
    return mime === p;
  });
}
