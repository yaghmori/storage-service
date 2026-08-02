import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ProcessingJobsRepository } from '../processing/repositories/processing-jobs.repository';
import {
  IMAGE_PROCESSING_QUEUE,
  METADATA_EXTRACTION_QUEUE,
  VIDEO_PROCESSING_QUEUE,
} from './queue-names';

export interface ImageProcessingJobData {
  fileId: string;
  orgId?: string;
  options?: {
    /** Named slots (preferred). */
    variants?: Array<{ name: 'thumbnail' | 'medium'; maxEdge: number }>;
    /** Legacy: first → thumbnail, second → medium. */
    sizes?: number[];
    formats?: ('webp' | 'avif')[];
  };
}

export interface VideoProcessingJobData {
  fileId: string;
  orgId?: string;
  options?: {
    previewFrames?: number;
    thumbnail?: boolean;
  };
}

export interface MetadataExtractionJobData {
  fileId: string;
  orgId?: string;
}

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectQueue(IMAGE_PROCESSING_QUEUE)
    private readonly imageProcessingQueue: Queue,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoProcessingQueue: Queue,
    @InjectQueue(METADATA_EXTRACTION_QUEUE)
    private readonly metadataExtractionQueue: Queue,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {}

  /**
   * Create the DB job row first, then enqueue with `jobId = row.id`.
   * Prevents the race where the worker starts before the row exists and
   * inserts a duplicate processing_jobs record.
   */
  private async enqueueTrackedJob(input: {
    queue: Queue;
    name: string;
    data: Record<string, unknown>;
    orgId: string;
    fileId: string;
    jobType: 'image' | 'video' | 'metadata';
    priority: number;
  }) {
    const record = await this.jobsRepository.create({
      orgId: input.orgId,
      fileId: input.fileId,
      jobType: input.jobType,
      status: 'pending',
      bullmqJobId: undefined,
    });

    // Use DB row id as BullMQ jobId so the worker can find this row immediately.
    await this.jobsRepository.setBullmqJobId(record.id, record.id);

    try {
      const bullmqJob = await input.queue.add(input.name, input.data, {
        jobId: record.id,
        priority: input.priority,
      });

      this.logger.log(
        `${input.jobType} job ${record.id} queued for file ${input.fileId} (bullmq=${bullmqJob.id})`,
      );
      return bullmqJob;
    } catch (error) {
      await this.jobsRepository.updateStatus(
        record.id,
        'failed',
        error instanceof Error ? error.message : 'Failed to enqueue job',
      );
      throw error;
    }
  }

  async addImageProcessingJob(data: ImageProcessingJobData) {
    if (!data.orgId) {
      throw new Error('orgId is required to enqueue image processing');
    }
    return this.enqueueTrackedJob({
      queue: this.imageProcessingQueue,
      name: 'process-image',
      data: data as unknown as Record<string, unknown>,
      orgId: data.orgId,
      fileId: data.fileId,
      jobType: 'image',
      priority: 1,
    });
  }

  async addVideoProcessingJob(data: VideoProcessingJobData) {
    if (!data.orgId) {
      throw new Error('orgId is required to enqueue video processing');
    }
    return this.enqueueTrackedJob({
      queue: this.videoProcessingQueue,
      name: 'process-video',
      data: data as unknown as Record<string, unknown>,
      orgId: data.orgId,
      fileId: data.fileId,
      jobType: 'video',
      priority: 1,
    });
  }

  async addMetadataExtractionJob(data: MetadataExtractionJobData) {
    if (!data.orgId) {
      throw new Error('orgId is required to enqueue metadata extraction');
    }
    return this.enqueueTrackedJob({
      queue: this.metadataExtractionQueue,
      name: 'extract-metadata',
      data: data as unknown as Record<string, unknown>,
      orgId: data.orgId,
      fileId: data.fileId,
      jobType: 'metadata',
      priority: 2,
    });
  }

  /**
   * Re-enqueue an existing DB job row (admin retry). Uses a unique BullMQ jobId
   * so retries never collide with the original id.
   */
  async requeueExistingJob(input: {
    jobId: string;
    orgId: string;
    fileId: string;
    jobType: 'image' | 'video' | 'metadata';
    retryAttempt: number;
  }) {
    const queue =
      input.jobType === 'image'
        ? this.imageProcessingQueue
        : input.jobType === 'video'
          ? this.videoProcessingQueue
          : this.metadataExtractionQueue;

    const name =
      input.jobType === 'image'
        ? 'process-image'
        : input.jobType === 'video'
          ? 'process-video'
          : 'extract-metadata';

    const priority = input.jobType === 'metadata' ? 2 : 1;
    const bullmqJobId = `${input.jobId}-r${input.retryAttempt}`;
    const data = {
      fileId: input.fileId,
      orgId: input.orgId,
      ...(input.jobType === 'image'
        ? {
            options: {
              variants: [
                { name: 'thumbnail' as const, maxEdge: 200 },
                { name: 'medium' as const, maxEdge: 800 },
              ],
              formats: ['webp'] as ('webp' | 'avif')[],
            },
          }
        : input.jobType === 'video'
          ? { options: { previewFrames: 3, thumbnail: true } }
          : {}),
    };

    await this.jobsRepository.setBullmqJobId(input.jobId, bullmqJobId);

    try {
      const bullmqJob = await queue.add(name, data, {
        jobId: bullmqJobId,
        priority,
      });
      this.logger.log(
        `Requeued ${input.jobType} job ${input.jobId} as ${bullmqJob.id} (attempt ${input.retryAttempt})`,
      );
      return bullmqJob;
    } catch (error) {
      await this.jobsRepository.updateStatus(
        input.jobId,
        'failed',
        error instanceof Error ? error.message : 'Failed to requeue job',
      );
      throw error;
    }
  }
}
