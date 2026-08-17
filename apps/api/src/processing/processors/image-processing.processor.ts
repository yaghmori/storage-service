import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { DelayedError, Job } from 'bullmq';
import { IMAGE_PROCESSING_QUEUE } from '../../queues/queue-names';
import { processorWorkerOptions } from '../../queues/queue-runtime-settings.service';
import { ImageProcessingJobData } from '../../queues/queues.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { ImageProcessingService } from '../services/image-processing.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';

@Processor(IMAGE_PROCESSING_QUEUE, processorWorkerOptions(IMAGE_PROCESSING_QUEUE))
export class ImageProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessingProcessor.name);

  constructor(
    private readonly imageProcessingService: ImageProcessingService,
    private readonly jobsRepository: ProcessingJobsRepository,
    private readonly rollup: FileProcessingRollupService,
    @Optional() private readonly capacity?: OrgProcessorCapacityService,
  ) {
    super();
  }

  async process(job: Job<ImageProcessingJobData>) {
    await this.capacity?.assertOrDelay(job, ProcessorKey.IMAGE_VARIANTS);

    const fileId =
      typeof job.data.fileId === 'number'
        ? String(job.data.fileId)
        : job.data.fileId;
    const orgId = job.data.orgId;
    this.logger.log(`Processing image job ${job.id} for file ${fileId}`);

    let jobRecord = job.id
      ? await this.jobsRepository.findByBullmqJobId(job.id)
      : null;

    if (jobRecord?.status === 'cancelled') {
      this.logger.log(`Skipping cancelled image.variants job ${jobRecord.id}`);
      return { success: false, cancelled: true, variants: [] };
    }

    try {
      if (jobRecord && job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'processing');
        await this.jobsRepository.appendLog(
          jobRecord.id,
          'info',
          `Worker picked up image.variants (attempt ${job.attemptsMade + 1})`,
        );
      } else if (!jobRecord) {
        jobRecord = await this.jobsRepository.create({
          fileId,
          orgId,
          processorKey: ProcessorKey.IMAGE_VARIANTS,
          status: 'processing',
          bullmqJobId: job.id,
        });
      }

      const variants = await this.imageProcessingService.processImage(
        fileId,
        job.data.options,
      );

      if (jobRecord) {
        await this.jobsRepository.appendLog(
          jobRecord.id,
          'info',
          `Created ${variants.length} variant(s)`,
        );
        await this.jobsRepository.setOutput(jobRecord.id, {
          variantCount: variants.length,
          variants: variants.map((v) => ({
            type: v.type,
            format: v.format,
            width: v.width,
            height: v.height,
            key: v.key,
          })),
        });
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
        `Image processing failed for file ${fileId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      if (job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(
          job.id,
          'failed',
          (error as Error).message,
        );
        if (jobRecord) {
          await this.jobsRepository.appendLog(
            jobRecord.id,
            'error',
            (error as Error).message,
          );
        }
      } else if (jobRecord) {
        await this.jobsRepository.updateStatus(
          jobRecord.id,
          'failed',
          (error as Error).message,
        );
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
