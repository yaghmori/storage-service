import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import {
  IMAGE_PROCESSING_QUEUE,
  VIDEO_PROCESSING_QUEUE,
  METADATA_EXTRACTION_QUEUE,
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
    private imageProcessingQueue: Queue,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private videoProcessingQueue: Queue,
    @InjectQueue(METADATA_EXTRACTION_QUEUE)
    private metadataExtractionQueue: Queue,
  ) {}

  async addImageProcessingJob(data: ImageProcessingJobData) {
    return this.imageProcessingQueue.add('process-image', data, {
      priority: 1,
    });
  }

  async addVideoProcessingJob(data: VideoProcessingJobData) {
    return this.videoProcessingQueue.add('process-video', data, {
      priority: 1,
    });
  }

  async addMetadataExtractionJob(data: MetadataExtractionJobData) {
    return this.metadataExtractionQueue.add('extract-metadata', data, {
      priority: 2,
    });
  }
}

