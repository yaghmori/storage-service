import type { FileResponse } from '../lib/contracts';
import type { files } from '../database/drizzle/schema';

type FileRow = typeof files.$inferSelect;

/**
 * Maps processing status from Drizzle enum to contract file status
 */
function mapProcessingStatusToFileStatus(
  processingStatus: FileRow['processingStatus'],
  deletedAt: Date | null,
): FileResponse['status'] {
  // If deleted, status is always 'deleted'
  if (deletedAt) {
    return 'deleted';
  }

  // Map processing status to file status
  switch (processingStatus) {
    case 'pending':
      return 'uploading';
    case 'processing':
      return 'processing';
    case 'completed':
    case 'partial':
    case 'skipped':
      return 'ready';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'failed';
    case null:
    case undefined:
      return 'ready';
    default:
      return 'ready';
  }
}

/**
 * Maps a Drizzle files table row to FileResponse contract type
 */
export function toFileResponse(row: FileRow | null): FileResponse | null {
  if (!row) return null;

  return {
    id: row.id,
    storageProviderId: row.storageProviderId,
    key: row.storageKey,
    originalFilename: row.originalFileName,
    mimeType: row.mimeType,
    size: Number(row.size),
    sha256Hash: row.fileHash,
    status: mapProcessingStatusToFileStatus(row.processingStatus, row.deletedAt),
    referenceCount: row.referenceCount,
    metadata: null, // Metadata is stored in separate table, not included in FileResponse
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
