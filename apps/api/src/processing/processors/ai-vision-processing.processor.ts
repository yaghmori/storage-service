import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessorKey } from '@workspace/validation';
import { AI_VISION_QUEUE } from '../../queues/queue-names';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { AiVisionProcessingService } from '../services/ai-vision-processing.service';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';

export type AiVisionJobData = {
  fileId: string;
  orgId: string;
  backendId?: string | null;
  settings?: Record<string, unknown>;
};

@Processor(AI_VISION_QUEUE, { concurrency: 1 })
export class AiVisionProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(AiVisionProcessingProcessor.name);

  constructor(
    private readonly aiVision: AiVisionProcessingService,
    private readonly jobsRepository: ProcessingJobsRepository,
    private readonly rollup: FileProcessingRollupService,
  ) {
    super();
  }

  async process(job: Job<AiVisionJobData>) {
    const { fileId, orgId, backendId, settings } = job.data;
    this.logger.log(`Processing ai.vision for file ${fileId}`);

    const tracked = await this.jobsRepository.findByBullmqJobId(String(job.id));
    if (tracked) {
      await this.jobsRepository.updateStatusByBullmqJobId(
        String(job.id),
        'processing',
      );
      await this.jobsRepository.appendLog(
        tracked.id,
        'info',
        `Worker picked up ai.vision (attempt ${job.attemptsMade + 1})`,
      );
    }

    try {
      await this.aiVision.process({
        fileId,
        orgId,
        jobId: tracked?.id,
        backendId,
        settings: (settings ?? {}) as Parameters<
          AiVisionProcessingService['process']
        >[0]['settings'],
      });

      if (tracked) {
        await this.jobsRepository.updateStatusByBullmqJobId(
          String(job.id),
          'completed',
        );
        await this.jobsRepository.appendLog(
          tracked.id,
          'info',
          'Job marked completed',
        );
      }
      await this.rollup.refresh(fileId, orgId);
      return { success: true, fileId, processorKey: ProcessorKey.AI_VISION };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`ai.vision failed for ${fileId}: ${message}`);
      if (tracked) {
        await this.jobsRepository.appendLog(tracked.id, 'error', message);
        await this.jobsRepository.updateStatusByBullmqJobId(
          String(job.id),
          'failed',
          message,
        );
      }
      await this.rollup.refresh(fileId, orgId);
      throw error;
    }
  }
}
