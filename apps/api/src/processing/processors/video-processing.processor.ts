import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { DelayedError, Job } from 'bullmq';
import { VIDEO_PROCESSING_QUEUE } from '../../queues/queue-names';
import { processorWorkerOptions } from '../../queues/queue-runtime-settings.service';
import { VideoProcessingJobData } from '../../queues/queues.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { VideoProcessingService } from '../services/video-processing.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';

@Processor(VIDEO_PROCESSING_QUEUE, {
  ...processorWorkerOptions(VIDEO_PROCESSING_QUEUE),
  lockDuration: 12 * 60 * 1000,
})
export class VideoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(
    private readonly videoProcessingService: VideoProcessingService,
    private readonly jobsRepository: ProcessingJobsRepository,
    private readonly rollup: FileProcessingRollupService,
    @Optional() private readonly capacity?: OrgProcessorCapacityService,
  ) {
    super();
  }

  async process(job: Job<VideoProcessingJobData>) {
    await this.capacity?.assertOrDelay(job, ProcessorKey.VIDEO_PREVIEW);

    const fileId =
      typeof job.data.fileId === 'number'
        ? String(job.data.fileId)
        : job.data.fileId;
    const orgId = job.data.orgId;
    this.logger.log(`Processing video job ${job.id} for file ${fileId}`);

    let jobRecord = job.id
      ? await this.jobsRepository.findByBullmqJobId(job.id)
      : null;

    try {
      if (jobRecord && job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'processing');
        await this.jobsRepository.appendLog(
          jobRecord.id,
          'info',
          `Worker picked up video.preview (attempt ${job.attemptsMade + 1})`,
        );
      } else if (!jobRecord) {
        jobRecord = await this.jobsRepository.create({
          fileId,
          orgId,
          processorKey: ProcessorKey.VIDEO_PREVIEW,
          status: 'processing',
          bullmqJobId: job.id,
        });
      }

      const variants = await this.videoProcessingService.processVideo(
        fileId,
        job.data.options,
      );

      if (jobRecord) {
        await this.jobsRepository.appendLog(
          jobRecord.id,
          'info',
          `Created ${Array.isArray(variants) ? variants.length : 0} preview artifact(s)`,
        );
      }

      if (job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'completed');
      } else if (jobRecord) {
        await this.jobsRepository.updateStatus(jobRecord.id, 'completed');
      }

      if (orgId) await this.rollup.refresh(fileId, orgId);
      return { success: true, variants };
    } catch (error) {
      if (error instanceof DelayedError) throw error;
      this.logger.error(
        `Video processing failed for file ${fileId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      if (job.id) {
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
      if (jobRecord) {
        await this.jobsRepository.appendLog(
          jobRecord.id,
          'error',
          (error as Error).message,
        );
      }
      if (orgId) await this.rollup.refresh(fileId, orgId);
      throw error;
    }
  }
}
