import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { NOTIFY_WEBHOOK_QUEUE } from '../../queues/queue-names';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { NotifyWebhookProcessingService } from '../services/notify-webhook-processing.service';

@Processor(NOTIFY_WEBHOOK_QUEUE, { concurrency: 4 })
export class NotifyWebhookProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(NotifyWebhookProcessingProcessor.name);

  constructor(
    private readonly service: NotifyWebhookProcessingService,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {
    super();
  }

  async process(
    job: Job<{
      fileId: string;
      orgId: string;
      processingStatus: string;
      processingError?: string | null;
    }>,
  ) {
    const { fileId, orgId, processingStatus, processingError } = job.data;
    const tracked = await this.jobsRepository.findByBullmqJobId(String(job.id));
    if (tracked) {
      await this.jobsRepository.updateStatusByBullmqJobId(
        String(job.id),
        'processing',
      );
      await this.jobsRepository.appendLog(
        tracked.id,
        'info',
        `Worker picked up notify.webhook (attempt ${job.attemptsMade + 1})`,
      );
    }
    try {
      await this.service.process({
        fileId,
        orgId,
        jobId: tracked?.id,
        processingStatus,
        processingError,
      });
      if (tracked) {
        await this.jobsRepository.updateStatusByBullmqJobId(
          String(job.id),
          'completed',
        );
        await this.jobsRepository.appendLog(
          tracked.id,
          'info',
          'Webhook delivery completed',
        );
      }
      // Do not refresh rollup — notify.webhook is a completion side-effect
      return { success: true, processorKey: ProcessorKey.NOTIFY_WEBHOOK };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(message);
      if (tracked) {
        await this.jobsRepository.appendLog(tracked.id, 'error', message);
        await this.jobsRepository.updateStatusByBullmqJobId(
          String(job.id),
          'failed',
          message,
        );
      }
      throw error;
    }
  }
}
