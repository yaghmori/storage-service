import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IMAGE_PROCESSING_QUEUE } from '../../queues/queue-names';
import { ImageProcessingJobData } from '../../queues/queues.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { ImageProcessingService } from '../services/image-processing.service';

@Processor(IMAGE_PROCESSING_QUEUE, { concurrency: 2 })
export class ImageProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessingProcessor.name);

  constructor(
    private readonly imageProcessingService: ImageProcessingService,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {
    super();
  }

  async process(job: Job<ImageProcessingJobData>) {
    const jobId = job.id || `temp-${Date.now()}`;
    this.logger.log(`Processing image job ${jobId} for file ${job.data.fileId}`);

    // Convert fileId to string if it's a number (for backward compatibility)
    const fileId = typeof job.data.fileId === 'number' ? String(job.data.fileId) : job.data.fileId;

    let jobRecord: Awaited<ReturnType<typeof this.jobsRepository.create>> | null = null;

    try {
      // Find existing job record (created when job was added to queue)
      jobRecord = job.id ? await this.jobsRepository.findByBullmqJobId(job.id) : null;

      // If record doesn't exist, create it (backward compatibility)
      if (!jobRecord) {
        jobRecord = await this.jobsRepository.create({
          fileId,
          jobType: 'image',
          status: 'processing',
          bullmqJobId: job.id,
        });
      } else if (job.id) {
        // Update existing record to processing
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'processing');
      }

      // Process image
      const variants = await this.imageProcessingService.processImage(
        fileId,
        job.data.options,
      );

      // Update job status to completed
      if (job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'completed');
      } else if (jobRecord) {
        await this.jobsRepository.updateStatus(jobRecord.id, 'completed');
      }

      this.logger.log(
        `Image processing completed for file ${fileId}, created ${variants.length} variants`,
      );

      return { success: true, variants };
    } catch (error) {
      this.logger.error(
        `Image processing failed for file ${fileId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // Update job status to failed
      if (job.id) {
        let failedJobRecord = await this.jobsRepository.findByBullmqJobId(job.id);
        if (!failedJobRecord) {
          failedJobRecord = await this.jobsRepository.create({
            fileId,
            jobType: 'image',
            status: 'failed',
            bullmqJobId: job.id,
          });
        }
        await this.jobsRepository.updateStatusByBullmqJobId(
          job.id,
          'failed',
          (error as Error).message,
        );
      } else if (jobRecord) {
        await this.jobsRepository.updateStatus(
          jobRecord.id,
          'failed',
          (error as Error).message,
        );
      }

      throw error;
    }
  }
}
