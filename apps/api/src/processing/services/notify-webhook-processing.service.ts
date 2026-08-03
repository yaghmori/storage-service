import { Injectable, Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { createHmac } from 'crypto';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { OrgProcessorsService } from './org-processors.service';

@Injectable()
export class NotifyWebhookProcessingService {
  private readonly logger = new Logger(NotifyWebhookProcessingService.name);

  constructor(
    private readonly orgProcessors: OrgProcessorsService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
  ) {}

  async process(input: {
    fileId: string;
    orgId: string;
    processingStatus: string;
    processingError?: string | null;
    jobId?: string;
  }) {
    const processor = (
      await this.orgProcessors.ensureDefaults(input.orgId)
    ).find(
      (row) =>
        row.processorKey === ProcessorKey.NOTIFY_WEBHOOK && row.enabled,
    );
    const settings = (processor?.settings ?? {}) as {
      url?: string;
      secret?: string;
      events?: string[];
    };
    const url = typeof settings.url === 'string' ? settings.url.trim() : '';
    if (!processor || !url) {
      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.NOTIFY_WEBHOOK,
        status: 'skipped',
        data: { reason: 'no_url' },
        jobId: input.jobId ?? null,
        processedAt: new Date(),
      });
      return { skipped: true };
    }

    const event = `processing.${input.processingStatus}`;
    const configuredEvents = Array.isArray(settings.events)
      ? settings.events.filter((value): value is string => typeof value === 'string')
      : ['processing.completed', 'processing.failed', 'processing.partial'];
    if (configuredEvents.length && !configuredEvents.includes(event)) {
      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.NOTIFY_WEBHOOK,
        status: 'skipped',
        data: { reason: 'event_filtered', event },
        jobId: input.jobId ?? null,
        processedAt: new Date(),
      });
      return { skipped: true, event };
    }

    const processorSummary = (await this.results.findByFileId(input.fileId))
      .filter((result) => result.processorKey !== ProcessorKey.NOTIFY_WEBHOOK)
      .map((result) => ({
        processorKey: result.processorKey,
        status: result.status,
        error: result.error,
      }));

    const payload = {
      event,
      fileId: input.fileId,
      orgId: input.orgId,
      processingStatus: input.processingStatus,
      processingError: input.processingError ?? null,
      processorSummary,
    };
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'storage-service-notify-webhook',
    };
    if (typeof settings.secret === 'string' && settings.secret.trim()) {
      headers['X-Storage-Signature'] = createHmac('sha256', settings.secret)
        .update(body)
        .digest('hex');
    }

    await this.log(input.jobId, 'info', `POST ${url} event=${event}`);
    const response = await fetch(url, { method: 'POST', headers, body });
    const responseText = await response.text().catch(() => '');
    await this.log(
      input.jobId,
      response.ok ? 'info' : 'error',
      `Webhook response ${response.status}: ${responseText.slice(0, 300)}`,
    );

    if (!response.ok) {
      throw new Error(`Webhook failed with HTTP ${response.status}`);
    }

    const data = { event, statusCode: response.status, url };
    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.NOTIFY_WEBHOOK,
      status: 'completed',
      data,
      jobId: input.jobId ?? null,
      processedAt: new Date(),
      error: null,
    });
    if (input.jobId) await this.jobs.setOutput(input.jobId, data);
    return { skipped: false, data };
  }

  private async log(
    jobId: string | undefined,
    level: 'info' | 'warn' | 'error',
    message: string,
  ) {
    if (!jobId) return;
    await this.jobs.appendLog(jobId, level, message).catch((error) => {
      this.logger.warn(`log failed: ${error}`);
    });
  }
}
