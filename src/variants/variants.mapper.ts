import type { VariantResponse } from '@yaghmori/messaging-contracts';
import type { fileVariants } from '../database/drizzle/schema';

type VariantRow = typeof fileVariants.$inferSelect;

/**
 * Derives MIME type from format if available, otherwise returns a default
 */
function getMimeType(format: string | null | undefined): string {
  if (!format) return 'application/octet-stream';

  const mimeTypes: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    svg: 'image/svg+xml',
  };

  return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
}

/**
 * Maps a Drizzle fileVariants table row to VariantResponse contract type
 */
export function toVariantResponse(row: VariantRow | null): VariantResponse | null {
  if (!row) return null;

  return {
    id: row.id,
    fileId: row.fileId,
    name: row.variantType, // variantType is the name of the variant (e.g., 'thumbnail', 'webp')
    key: row.variantKey,
    mimeType: getMimeType(row.format),
    size: Number(row.size),
    metadata: null, // Metadata not stored in variants table
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.createdAt.toISOString(), // Variants don't have updatedAt, use createdAt
  };
}
