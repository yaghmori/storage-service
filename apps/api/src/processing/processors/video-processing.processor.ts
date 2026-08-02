import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { VIDEO_PROCESSING_QUEUE } from '../../queues/queue-names';
import { VideoProcessingJobData } from '../../queues/queues.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { VideoProcessingService } from '../services/video-processing.service';

@Processor(VIDEO_PROCESSING_QUEUE, { concurrency: 1 })
export class VideoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(
    private readonly videoProcessingService: VideoProcessingService,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {
    super();
  }

  async process(job: Job<VideoProcessingJobData>) {
    const jobId = job.id || `temp-${Date.now()}`;
    this.logger.log(`Processing video job ${jobId} for file ${job.data.fileId}`);

    // Convert fileId to string if it's a number
    const fileId = typeof job.data.fileId === 'number' ? String(job.data.fileId) : job.data.fileId;

    let jobRecord: Awaited<ReturnType<typeof this.jobsRepository.create>> | null = null;

    try {
      // Prefer existing row (created before enqueue). Do not insert duplicates.
      jobRecord = job.id ? await this.jobsRepository.findByBullmqJobId(job.id) : null;

      if (jobRecord && job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'processing');
      } else if (!jobRecord) {
        // Legacy jobs enqueued before DB-first tracking
        jobRecord = await this.jobsRepository.create({
          fileId,
          jobType: 'video',
          status: 'processing',
          bullmqJobId: job.id,
        });
      }

      // Process video
      const variants = await this.videoProcessingService.processVideo(
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
        `Video processing completed for file ${fileId}, created ${variants.length} variants`,
      );

      return { success: true, variants };
    } catch (error) {
      this.logger.error(
        `Video processing failed for file ${fileId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // Update job status to failed
      if (job.id) {
        let failedJobRecord = await this.jobsRepository.findByBullmqJobId(job.id);
        if (!failedJobRecord) {
          failedJobRecord = await this.jobsRepository.create({
            fileId,
            jobType: 'video',
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
