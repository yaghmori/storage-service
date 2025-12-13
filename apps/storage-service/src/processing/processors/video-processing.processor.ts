import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { VideoProcessingService } from '../services/video-processing.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { QueuesService, VideoProcessingJobData } from '../../queues/queues.service';
import { VIDEO_PROCESSING_QUEUE } from '../../queues/queue-names';

@Processor(VIDEO_PROCESSING_QUEUE)
export class VideoProcessingProcessor {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(
    private readonly videoProcessingService: VideoProcessingService,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {}

  @Process('process-video')
  async handleVideoProcessing(job: Job<VideoProcessingJobData>) {
    this.logger.log(`Processing video job ${job.id} for file ${job.data.fileId}`);
    
    // Convert fileId to string if it's a number
    const fileId = typeof job.data.fileId === 'number' ? String(job.data.fileId) : job.data.fileId;

    try {
      // Create job record
      const jobRecord = await this.jobsRepository.create({
        fileId,
        jobType: 'video',
        status: 'processing',
        bullmqJobId: job.id,
      });

      // Update job status to processing
      await this.jobsRepository.updateStatus(jobRecord.id, 'processing');

      // Process video
      const variants = await this.videoProcessingService.processVideo(
        fileId,
        job.data.options,
      );

      // Update job status to completed
      await this.jobsRepository.updateStatus(jobRecord.id, 'completed');

      this.logger.log(
        `Video processing completed for file ${fileId}, created ${variants.length} variants`,
      );

      return { success: true, variants };
    } catch (error) {
      this.logger.error(
        `Video processing failed for file ${fileId}: ${error.message}`,
        error.stack,
      );

      // Update job status to failed
      const jobRecord = await this.jobsRepository.create({
        fileId,
        jobType: 'video',
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

