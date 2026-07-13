import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ProcessingJobsRepository } from '../processing/repositories/processing-jobs.repository';
import {
  IMAGE_PROCESSING_QUEUE,
  METADATA_EXTRACTION_QUEUE,
  VIDEO_PROCESSING_QUEUE,
} from './queue-names';

export interface ImageProcessingJobData {
  fileId: string;
  options?: {
    sizes?: number[];
    formats?: ('webp' | 'avif')[];
  };
}

export interface VideoProcessingJobData {
  fileId: string;
  options?: {
    previewFrames?: number;
    thumbnail?: boolean;
  };
}

export interface MetadataExtractionJobData {
  fileId: string;
}

@Injectable()
export class QueuesService {
  constructor(
    @InjectQueue(IMAGE_PROCESSING_QUEUE)
    private readonly imageProcessingQueue: Queue,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoProcessingQueue: Queue,
    @InjectQueue(METADATA_EXTRACTION_QUEUE)
    private readonly metadataExtractionQueue: Queue,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {
    console.log('[QueuesService] Queues initialized with @nestjs/bullmq');
  }

  async addImageProcessingJob(data: ImageProcessingJobData) {
    console.log('[QueuesService] Adding image processing job for file:', data.fileId);

    try {
      const bullmqJob = await this.imageProcessingQueue.add('process-image', data, {
        priority: 1,
      });
      console.log('[QueuesService] Image job added to queue with ID:', bullmqJob.id);

      // Create database record immediately
      try {
        await this.jobsRepository.create({
          fileId: data.fileId,
          jobType: 'image',
          status: 'pending',
          bullmqJobId: bullmqJob.id,
        });
        console.log('[QueuesService] Database record created for job:', bullmqJob.id);
      } catch (dbError) {
        console.error('[QueuesService] Failed to create database record for job:', dbError);
        // Continue - the job is already in the queue
      }

      return bullmqJob;
    } catch (error) {
      console.error('[QueuesService] Failed to add image processing job:', error);
      console.error('[QueuesService] Error stack:', error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  async addVideoProcessingJob(data: VideoProcessingJobData) {
    console.log('[QueuesService] Adding video processing job for file:', data.fileId);
    try {
      const bullmqJob = await this.videoProcessingQueue.add('process-video', data, {
        priority: 1,
      });
      console.log('[QueuesService] Video job added to queue with ID:', bullmqJob.id);

      // Create database record immediately
      try {
        await this.jobsRepository.create({
          fileId: data.fileId,
          jobType: 'video',
          status: 'pending',
          bullmqJobId: bullmqJob.id,
        });
        console.log('[QueuesService] Database record created for job:', bullmqJob.id);
      } catch (dbError) {
        console.error('[QueuesService] Failed to create database record for job:', dbError);
        // Continue - the job is already in the queue
      }

      return bullmqJob;
    } catch (error) {
      console.error('[QueuesService] Failed to add video processing job:', error);
      console.error('[QueuesService] Error stack:', error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  async addMetadataExtractionJob(data: MetadataExtractionJobData) {
    console.log('[QueuesService] Adding metadata extraction job for file:', data.fileId);
    try {
      const bullmqJob = await this.metadataExtractionQueue.add('extract-metadata', data, {
        priority: 2,
      });
      console.log('[QueuesService] Metadata job added to queue with ID:', bullmqJob.id);

      // Create database record immediately
      try {
        await this.jobsRepository.create({
          fileId: data.fileId,
          jobType: 'metadata',
          status: 'pending',
          bullmqJobId: bullmqJob.id,
        });
        console.log('[QueuesService] Database record created for job:', bullmqJob.id);
      } catch (dbError) {
        console.error('[QueuesService] Failed to create database record for job:', dbError);
        // Continue - the job is already in the queue
      }

      return bullmqJob;
    } catch (error) {
      console.error('[QueuesService] Failed to add metadata extraction job:', error);
      console.error('[QueuesService] Error stack:', error instanceof Error ? error.stack : error);
      throw error;
    }
  }
}
