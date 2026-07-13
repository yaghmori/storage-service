import type { ProcessingJobResponse } from '@platform/messaging-contracts';
import type { processingJobs } from '../database/drizzle/schema';

type ProcessingJobRow = typeof processingJobs.$inferSelect;

/**
 * Maps job type from DB enum to contract enum
 * DB: 'image', 'video', 'metadata', 'thumbnail', 'transcode'
 * Contract: 'thumbnail', 'resize', 'compress', 'convert', 'transcode'
 */
function mapJobType(dbJobType: string): ProcessingJobResponse['type'] {
  const typeMap: Record<string, ProcessingJobResponse['type']> = {
    thumbnail: 'thumbnail',
    transcode: 'transcode',
    image: 'resize', // Default image processing to resize
    video: 'transcode', // Video processing is transcode
    metadata: 'convert', // Metadata extraction is a form of conversion
  };

  return typeMap[dbJobType] || 'resize';
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
    type: mapJobType(row.jobType),
    status: mapProcessingStatus(row.status),
    parameters: null, // Parameters not stored in processingJobs table
    result: null, // Result not stored in processingJobs table
    error: row.errorMessage ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.createdAt.toISOString(), // ProcessingJobs don't have updatedAt, use createdAt
  };
}
