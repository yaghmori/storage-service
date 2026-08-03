import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { Queue } from 'bullmq';
import { PROCESSOR_QUEUE_BY_KEY } from '../processing/constants/processor-keys';
import { ProcessingJobsRepository } from '../processing/repositories/processing-jobs.repository';
import {
  AI_VISION_QUEUE,
  DEDUPE_PHASH_QUEUE,
  DOCUMENT_OCR_QUEUE,
  DOCUMENT_PREVIEW_QUEUE,
  DOCUMENT_TEXT_QUEUE,
  IMAGE_NORMALIZE_QUEUE,
  IMAGE_PROCESSING_QUEUE,
  INTEGRITY_VERIFY_QUEUE,
  METADATA_EXTRACTION_QUEUE,
  NOTIFY_WEBHOOK_QUEUE,
  VIDEO_PROCESSING_QUEUE,
} from './queue-names';

export interface ImageProcessingJobData {
  fileId: string;
  orgId?: string;
  options?: {
    variants?: Array<{ name: 'thumbnail' | 'medium'; maxEdge: number }>;
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

export interface AiVisionJobData {
  fileId: string;
  orgId?: string;
  backendId?: string | null;
  settings?: Record<string, unknown>;
}

const JOB_NAME_BY_PROCESSOR: Record<string, string> = {
  [ProcessorKey.IMAGE_NORMALIZE]: 'process-image-normalize',
  [ProcessorKey.IMAGE_VARIANTS]: 'process-image',
  [ProcessorKey.VIDEO_PREVIEW]: 'process-video',
  [ProcessorKey.METADATA_EXIF]: 'extract-metadata',
  [ProcessorKey.AI_VISION]: 'process-ai-vision',
  [ProcessorKey.DEDUPE_PHASH]: 'process-dedupe-phash',
  [ProcessorKey.INTEGRITY_VERIFY]: 'process-integrity-verify',
  [ProcessorKey.DOCUMENT_PREVIEW]: 'process-document-preview',
  [ProcessorKey.DOCUMENT_TEXT]: 'process-document-text',
  [ProcessorKey.DOCUMENT_OCR]: 'process-document-ocr',
  [ProcessorKey.NOTIFY_WEBHOOK]: 'process-notify-webhook',
};

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectQueue(IMAGE_NORMALIZE_QUEUE)
    private readonly imageNormalizeQueue: Queue,
    @InjectQueue(IMAGE_PROCESSING_QUEUE)
    private readonly imageProcessingQueue: Queue,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoProcessingQueue: Queue,
    @InjectQueue(METADATA_EXTRACTION_QUEUE)
    private readonly metadataExtractionQueue: Queue,
    @InjectQueue(AI_VISION_QUEUE)
    private readonly aiVisionQueue: Queue,
    @InjectQueue(DEDUPE_PHASH_QUEUE)
    private readonly dedupePhashQueue: Queue,
    @InjectQueue(INTEGRITY_VERIFY_QUEUE)
    private readonly integrityVerifyQueue: Queue,
    @InjectQueue(DOCUMENT_PREVIEW_QUEUE)
    private readonly documentPreviewQueue: Queue,
    @InjectQueue(DOCUMENT_TEXT_QUEUE)
    private readonly documentTextQueue: Queue,
    @InjectQueue(DOCUMENT_OCR_QUEUE)
    private readonly documentOcrQueue: Queue,
    @InjectQueue(NOTIFY_WEBHOOK_QUEUE)
    private readonly notifyWebhookQueue: Queue,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {}

  private queueFor(processorKey: string): Queue {
    const name = PROCESSOR_QUEUE_BY_KEY[processorKey];
    switch (name) {
      case IMAGE_NORMALIZE_QUEUE:
        return this.imageNormalizeQueue;
      case IMAGE_PROCESSING_QUEUE:
        return this.imageProcessingQueue;
      case VIDEO_PROCESSING_QUEUE:
        return this.videoProcessingQueue;
      case METADATA_EXTRACTION_QUEUE:
        return this.metadataExtractionQueue;
      case AI_VISION_QUEUE:
        return this.aiVisionQueue;
      case DEDUPE_PHASH_QUEUE:
        return this.dedupePhashQueue;
      case INTEGRITY_VERIFY_QUEUE:
        return this.integrityVerifyQueue;
      case DOCUMENT_PREVIEW_QUEUE:
        return this.documentPreviewQueue;
      case DOCUMENT_TEXT_QUEUE:
        return this.documentTextQueue;
      case DOCUMENT_OCR_QUEUE:
        return this.documentOcrQueue;
      case NOTIFY_WEBHOOK_QUEUE:
        return this.notifyWebhookQueue;
      default:
        throw new Error(`No queue registered for processor_key=${processorKey}`);
    }
  }

  async enqueueProcessorJob(input: {
    processorKey: string;
    orgId: string;
    fileId: string;
    backendId?: string | null;
    parameters?: Record<string, unknown>;
    data: Record<string, unknown>;
    priority?: number;
  }) {
    const queue = this.queueFor(input.processorKey);
    const name =
      JOB_NAME_BY_PROCESSOR[input.processorKey] ?? `process-${input.processorKey}`;

    const record = await this.jobsRepository.create({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: input.processorKey,
      status: 'pending',
      backendId: input.backendId ?? null,
      parameters: input.parameters ?? {},
      priority: input.priority ?? 0,
    });

    await this.jobsRepository.setBullmqJobId(record.id, record.id);

    try {
      const bullmqJob = await queue.add(name, input.data, {
        jobId: record.id,
        priority: input.priority ?? 0,
      });

      this.logger.log(
        `${input.processorKey} job ${record.id} queued for file ${input.fileId} (bullmq=${bullmqJob.id})`,
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

  async enqueueNotifyWebhookJob(input: {
    orgId: string;
    fileId: string;
    processingStatus: string;
    processingError?: string | null;
  }) {
    return this.enqueueProcessorJob({
      processorKey: ProcessorKey.NOTIFY_WEBHOOK,
      orgId: input.orgId,
      fileId: input.fileId,
      parameters: {
        processingStatus: input.processingStatus,
        processingError: input.processingError ?? null,
      },
      data: {
        fileId: input.fileId,
        orgId: input.orgId,
        processingStatus: input.processingStatus,
        processingError: input.processingError ?? null,
      },
      priority: 10,
    });
  }

  async addImageProcessingJob(data: ImageProcessingJobData) {
    if (!data.orgId) throw new Error('orgId is required');
    return this.enqueueProcessorJob({
      processorKey: ProcessorKey.IMAGE_VARIANTS,
      orgId: data.orgId,
      fileId: data.fileId,
      parameters: data.options as Record<string, unknown>,
      data: data as unknown as Record<string, unknown>,
      priority: 1,
    });
  }

  async addVideoProcessingJob(data: VideoProcessingJobData) {
    if (!data.orgId) throw new Error('orgId is required');
    return this.enqueueProcessorJob({
      processorKey: ProcessorKey.VIDEO_PREVIEW,
      orgId: data.orgId,
      fileId: data.fileId,
      parameters: data.options as Record<string, unknown>,
      data: data as unknown as Record<string, unknown>,
      priority: 1,
    });
  }

  async addMetadataExtractionJob(data: MetadataExtractionJobData) {
    if (!data.orgId) throw new Error('orgId is required');
    return this.enqueueProcessorJob({
      processorKey: ProcessorKey.METADATA_EXIF,
      orgId: data.orgId,
      fileId: data.fileId,
      data: data as unknown as Record<string, unknown>,
      priority: 2,
    });
  }

  async requeueExistingJob(input: {
    jobId: string;
    orgId: string;
    fileId: string;
    processorKey: string;
    retryAttempt: number;
    parameters?: Record<string, unknown> | null;
  }) {
    const queue = this.queueFor(input.processorKey);
    const name =
      JOB_NAME_BY_PROCESSOR[input.processorKey] ??
      `process-${input.processorKey}`;
    const priority =
      input.processorKey === ProcessorKey.IMAGE_NORMALIZE
        ? 0
        : input.processorKey === ProcessorKey.METADATA_EXIF
          ? 2
          : input.processorKey === ProcessorKey.AI_VISION ||
              input.processorKey === ProcessorKey.DEDUPE_PHASH
            ? 3
            : input.processorKey === ProcessorKey.DOCUMENT_PREVIEW ||
                input.processorKey === ProcessorKey.DOCUMENT_TEXT ||
                input.processorKey === ProcessorKey.DOCUMENT_OCR
              ? 4
              : input.processorKey === ProcessorKey.INTEGRITY_VERIFY
                ? 5
              : input.processorKey === ProcessorKey.NOTIFY_WEBHOOK
                ? 10
                : 1;
    const bullmqJobId = `${input.jobId}-r${input.retryAttempt}`;

    const params = (input.parameters ?? {}) as Record<string, unknown>;
    let data: Record<string, unknown> = {
      fileId: input.fileId,
      orgId: input.orgId,
    };

    if (input.processorKey === ProcessorKey.IMAGE_VARIANTS) {
      data = {
        ...data,
        options: params.variants
          ? params
          : {
              variants: [
                { name: 'thumbnail', maxEdge: 200 },
                { name: 'medium', maxEdge: 800 },
              ],
              formats: ['webp'],
            },
      };
    } else if (input.processorKey === ProcessorKey.VIDEO_PREVIEW) {
      data = {
        ...data,
        options: {
          previewFrames:
            typeof params.previewFrames === 'number' ? params.previewFrames : 3,
          thumbnail:
            typeof params.thumbnail === 'boolean' ? params.thumbnail : true,
        },
      };
    } else if (
      input.processorKey === ProcessorKey.AI_VISION ||
      input.processorKey === ProcessorKey.DOCUMENT_OCR
    ) {
      data = {
        ...data,
        backendId: params.backendId ?? null,
        settings: params.settings ?? params,
      };
    } else if (input.processorKey === ProcessorKey.NOTIFY_WEBHOOK) {
      data = {
        ...data,
        processingStatus: params.processingStatus ?? 'completed',
        processingError: params.processingError ?? null,
      };
    } else if (
      input.processorKey === ProcessorKey.IMAGE_NORMALIZE ||
      input.processorKey === ProcessorKey.DEDUPE_PHASH ||
      input.processorKey === ProcessorKey.DOCUMENT_PREVIEW ||
      input.processorKey === ProcessorKey.DOCUMENT_TEXT
    ) {
      data = { ...data, settings: params };
    }

    await this.jobsRepository.setBullmqJobId(input.jobId, bullmqJobId);

    try {
      const bullmqJob = await queue.add(name, data, {
        jobId: bullmqJobId,
        priority,
      });
      this.logger.log(
        `Requeued ${input.processorKey} job ${input.jobId} as ${bullmqJob.id} (attempt ${input.retryAttempt})`,
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
