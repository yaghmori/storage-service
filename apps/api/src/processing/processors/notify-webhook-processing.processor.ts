import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { DelayedError, Job } from 'bullmq';
import { NOTIFY_WEBHOOK_QUEUE } from '../../queues/queue-names';
import { processorWorkerOptions } from '../../queues/queue-runtime-settings.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { NotifyWebhookProcessingService } from '../services/notify-webhook-processing.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';

@Processor(NOTIFY_WEBHOOK_QUEUE, processorWorkerOptions(NOTIFY_WEBHOOK_QUEUE))
export class NotifyWebhookProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(NotifyWebhookProcessingProcessor.name);

  constructor(
    private readonly service: NotifyWebhookProcessingService,
    private readonly jobsRepository: ProcessingJobsRepository,
    @Optional() private readonly capacity?: OrgProcessorCapacityService,
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
    await this.capacity?.assertOrDelay(job, ProcessorKey.NOTIFY_WEBHOOK);

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
      if (error instanceof DelayedError) throw error;
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
