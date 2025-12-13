import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ImageProcessingService } from '../services/image-processing.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { QueuesService, ImageProcessingJobData } from '../../queues/queues.service';
import { IMAGE_PROCESSING_QUEUE } from '../../queues/queue-names';

@Processor(IMAGE_PROCESSING_QUEUE)
export class ImageProcessingProcessor {
  private readonly logger = new Logger(ImageProcessingProcessor.name);

  constructor(
    private readonly imageProcessingService: ImageProcessingService,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {}

  @Process('process-image')
  async handleImageProcessing(job: Job<ImageProcessingJobData>) {
    this.logger.log(`Processing image job ${job.id} for file ${job.data.fileId}`);
    
    // Convert fileId to string if it's a number (for backward compatibility)
    const fileId = typeof job.data.fileId === 'number' ? String(job.data.fileId) : job.data.fileId;

    try {
      // Create job record
      const jobRecord = await this.jobsRepository.create({
        fileId,
        jobType: 'image',
        status: 'processing',
        bullmqJobId: job.id,
      });

      // Update job status to processing
      await this.jobsRepository.updateStatus(jobRecord.id, 'processing');

      // Process image
      const variants = await this.imageProcessingService.processImage(
        fileId,
        job.data.options,
      );

      // Update job status to completed
      await this.jobsRepository.updateStatus(jobRecord.id, 'completed');

      this.logger.log(
        `Image processing completed for file ${fileId}, created ${variants.length} variants`,
      );

      return { success: true, variants };
    } catch (error) {
      this.logger.error(
        `Image processing failed for file ${fileId}: ${error.message}`,
        error.stack,
      );

      // Update job status to failed
      const jobRecord = await this.jobsRepository.create({
        fileId,
        jobType: 'image',
        status: 'failed',
        bullmqJobId: job.id,
      });
      await this.jobsRepository.updateStatus(
        jobRecord.id,
        'failed',
        error.message,
      );

      throw error;
    }
  }
}

