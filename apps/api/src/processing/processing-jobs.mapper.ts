import type { ProcessingJobResponse } from '../lib/contracts';
import type { processingJobs } from '../database/drizzle/schema';

type ProcessingJobRow = typeof processingJobs.$inferSelect;

/**
 * Maps processor key to the legacy contract enum.
 * Contract: 'thumbnail', 'resize', 'compress', 'convert', 'transcode'
 */
function mapJobType(processorKey: string): ProcessingJobResponse['type'] {
  const typeMap: Record<string, ProcessingJobResponse['type']> = {
    'image.variants': 'resize',
    'video.preview': 'transcode',
    'metadata.exif': 'convert',
    'ai.vision': 'convert',
  };

  return typeMap[processorKey] || 'convert';
}

/**
 * Maps processing status from DB enum to contract enum
 * DB: 'pending', 'processing', 'completed', 'failed', 'cancelled'
 * Contract: 'pending', 'processing', 'completed', 'failed'
 */
function mapProcessingStatus(
  dbStatus: string,
): ProcessingJobResponse['status'] {
  if (dbStatus === 'cancelled') {
    return 'failed'; // Map cancelled to failed
  }
  return dbStatus as ProcessingJobResponse['status'];
}

/**
 * Maps a Drizzle processingJobs table row to ProcessingJobResponse contract type
 */
export function toProcessingJobResponse(
  row: ProcessingJobRow | null,
): ProcessingJobResponse | null {
  if (!row) return null;

  return {
    id: row.id,
    fileId: row.fileId,
    type: mapJobType(row.processorKey),
    status: mapProcessingStatus(row.status),
    parameters: row.parameters as Record<string, unknown> | null,
    result: null, // Result not stored in processingJobs table
    error: row.errorMessage ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.createdAt.toISOString(), // ProcessingJobs don't have updatedAt, use createdAt
  };
}
