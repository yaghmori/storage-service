import { Logger, Optional } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { DelayedError, Job } from 'bullmq';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';

export type RoadmapJobData = {
  fileId: string;
  orgId: string;
  backendId?: string | null;
  settings?: Record<string, unknown>;
  processingStatus?: string;
  processingError?: string | null;
};

export abstract class RoadmapProcessingProcessor extends WorkerHost {
  private readonly baseLogger = new Logger(RoadmapProcessingProcessor.name);

  protected constructor(
    private readonly jobs: ProcessingJobsRepository,
    private readonly results: FileProcessorResultsRepository,
    private readonly rollup: FileProcessingRollupService,
    @Optional()
    private readonly capacity?: OrgProcessorCapacityService,
  ) {
    super();
  }

  protected async execute(
    job: Job<RoadmapJobData>,
    processorKey: string,
    run: (jobId?: string) => Promise<{ skipped?: boolean } | unknown>,
  ) {
    try {
      await this.capacity?.assertOrDelay(job, processorKey);
    } catch (error) {
      if (error instanceof DelayedError) throw error;
      throw error;
    }

    const tracked = await this.jobs.findByBullmqJobId(String(job.id));
    if (tracked) {
      await this.jobs.updateStatusByBullmqJobId(String(job.id), 'processing');
      await this.jobs.appendLog(
        tracked.id,
        'info',
        `Worker picked up ${processorKey} (attempt ${job.attemptsMade + 1})`,
      );
    }
    try {
      const output = await run(tracked?.id);
      const skipped =
        !!output &&
        typeof output === 'object' &&
        'skipped' in output &&
        output.skipped === true;
      const skipReason =
        skipped &&
        output &&
        typeof output === 'object' &&
        'reason' in output &&
        typeof (output as { reason?: unknown }).reason === 'string'
          ? (output as { reason: string }).reason
          : skipped &&
              output &&
              typeof output === 'object' &&
              'error' in output &&
              typeof (output as { error?: unknown }).error === 'string'
            ? (output as { error: string }).error
            : null;
      if (tracked) {
        await this.jobs.updateStatusByBullmqJobId(
          String(job.id),
          skipped ? 'skipped' : 'completed',
          skipped ? skipReason : null,
        );
        await this.jobs.appendLog(
          tracked.id,
          'info',
          skipped
            ? `Job marked skipped${skipReason ? `: ${skipReason}` : ''}`
            : 'Job marked completed',
        );
      }
      await this.rollup.refresh(job.data.fileId, job.data.orgId);
      return {
        success: true,
        skipped,
        skipReason,
        processorKey,
        fileId: job.data.fileId,
      };
    } catch (error) {
      if (error instanceof DelayedError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.baseLogger.error(
        `${processorKey} failed for ${job.data.fileId}: ${message}`,
      );
      if (tracked) {
        await this.jobs.appendLog(tracked.id, 'error', message);
        await this.jobs.updateStatusByBullmqJobId(
          String(job.id),
          'failed',
          message,
        );
      }
      const existing = await this.results.findByFileAndProcessor(
        job.data.fileId,
        processorKey,
      );
      const existingData =
        existing?.data &&
        typeof existing.data === 'object' &&
        !Array.isArray(existing.data) &&
        Object.keys(existing.data as object).length > 0
          ? (existing.data as Record<string, unknown>)
          : {};
      await this.results.upsert({
        orgId: job.data.orgId,
        fileId: job.data.fileId,
        processorKey,
        status: 'failed',
        data: existingData,
        error: existing?.error || message,
        jobId: tracked?.id ?? null,
        processedAt: new Date(),
      });
      await this.rollup.refresh(job.data.fileId, job.data.orgId);
      throw error;
    }
  }
}
