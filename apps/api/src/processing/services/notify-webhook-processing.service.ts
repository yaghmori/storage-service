import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  DEFAULT_NOTIFY_WEBHOOK_SETTINGS,
  NOTIFY_WEBHOOK_EVENTS,
  ProcessorKey,
  type NotifyWebhookEvent,
  type NotifyWebhookProcessorSettings,
} from '@workspace/validation';
import { createHmac } from 'crypto';
import { FilesService } from '../../files/services/files.service';
import { SignedUrlService } from '../../serving/services/signed-url.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { OrgProcessorsService } from './org-processors.service';

const WEBHOOK_TIMEOUT_MS = 30_000;

type NotifySettings = NotifyWebhookProcessorSettings;

@Injectable()
export class NotifyWebhookProcessingService {
  private readonly logger = new Logger(NotifyWebhookProcessingService.name);

  constructor(
    private readonly orgProcessors: OrgProcessorsService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
    private readonly files: FilesService,
    @Optional() private readonly signedUrls?: SignedUrlService,
  ) {}

  async process(input: {
    fileId: string;
    orgId: string;
    processingStatus: string;
    processingError?: string | null;
    jobId?: string;
  }) {
    const settings = await this.loadSettings(input.orgId);
    const url = settings.url?.trim() ?? '';
    if (!url) {
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

    const event = `processing.${input.processingStatus}` as NotifyWebhookEvent;
    const configuredEvents = this.resolveEvents(settings.events);
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

    const fileMeta = await this.buildFileMeta(
      input.fileId,
      input.orgId,
      settings.includeDownloadUrl !== false,
    );

    const payload = {
      event,
      fileId: input.fileId,
      orgId: input.orgId,
      processingStatus: input.processingStatus,
      processingError: input.processingError ?? null,
      file: fileMeta,
      processorSummary,
      sentAt: new Date().toISOString(),
    };

    const delivery = await this.deliver(url, settings, payload);
    await this.log(
      input.jobId,
      delivery.ok ? 'info' : 'error',
      `Webhook response ${delivery.statusCode}: ${delivery.responseText.slice(0, 300)}`,
    );

    if (!delivery.ok) {
      throw new Error(`Webhook failed with HTTP ${delivery.statusCode}`);
    }

    const data = {
      event,
      statusCode: delivery.statusCode,
      url,
    };
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

  /**
   * Fire a sample (or real-file) webhook using saved settings and/or overrides.
   * Used by the admin "Send sample" action — does not create a processing job.
   */
  async sendTest(input: {
    orgId: string;
    overrides?: Partial<NotifySettings> & { event?: NotifyWebhookEvent };
    fileId?: string | null;
  }) {
    const saved = await this.loadSettings(input.orgId, { requireEnabled: false });
    const merged: NotifySettings = {
      ...DEFAULT_NOTIFY_WEBHOOK_SETTINGS,
      ...saved,
      ...Object.fromEntries(
        Object.entries(input.overrides ?? {}).filter(
          ([, value]) => value !== undefined,
        ),
      ),
    };
    const url = merged.url?.trim() ?? '';
    if (!url) {
      throw new BadRequestException('Webhook URL is required');
    }

    const event =
      input.overrides?.event &&
      (NOTIFY_WEBHOOK_EVENTS as readonly string[]).includes(input.overrides.event)
        ? input.overrides.event
        : 'processing.completed';

    let fileMeta: Record<string, unknown>;
    let processorSummary: Array<{
      processorKey: string;
      status: string;
      error: string | null;
    }>;
    let fileId = input.fileId?.trim() || null;

    if (fileId) {
      fileMeta = await this.buildFileMeta(
        fileId,
        input.orgId,
        merged.includeDownloadUrl !== false,
      );
      processorSummary = (await this.results.findByFileId(fileId))
        .filter((result) => result.processorKey !== ProcessorKey.NOTIFY_WEBHOOK)
        .map((result) => ({
          processorKey: result.processorKey,
          status: result.status,
          error: result.error,
        }));
    } else {
      fileId = '00000000-0000-4000-8000-000000000000';
      fileMeta = {
        originalFileName: 'sample-test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        downloadUrl: null,
        downloadUrlExpiresIn: null,
      };
      processorSummary = [
        {
          processorKey: 'metadata.exif',
          status: 'completed',
          error: null,
        },
      ];
    }

    const payload = {
      event,
      fileId,
      orgId: input.orgId,
      processingStatus: event.replace('processing.', ''),
      processingError: null,
      file: fileMeta,
      processorSummary,
      sample: true,
      sentAt: new Date().toISOString(),
    };

    const delivery = await this.deliver(url, merged, payload);
    return {
      ok: delivery.ok,
      statusCode: delivery.statusCode,
      url,
      event,
      responsePreview: delivery.responseText.slice(0, 500),
      payload,
    };
  }

  private async loadSettings(
    orgId: string,
    options?: { requireEnabled?: boolean },
  ): Promise<NotifySettings> {
    const requireEnabled = options?.requireEnabled !== false;
    const processor = (await this.orgProcessors.ensureDefaults(orgId)).find(
      (row) =>
        row.processorKey === ProcessorKey.NOTIFY_WEBHOOK &&
        (!requireEnabled || row.enabled),
    );
    return {
      ...DEFAULT_NOTIFY_WEBHOOK_SETTINGS,
      ...((processor?.settings ?? {}) as NotifySettings),
    };
  }

  private resolveEvents(events: NotifySettings['events']): NotifyWebhookEvent[] {
    if (!Array.isArray(events) || events.length === 0) {
      return [...NOTIFY_WEBHOOK_EVENTS];
    }
    return events.filter((value): value is NotifyWebhookEvent =>
      (NOTIFY_WEBHOOK_EVENTS as readonly string[]).includes(value),
    );
  }

  private async buildFileMeta(
    fileId: string,
    orgId: string,
    includeDownloadUrl: boolean,
  ): Promise<Record<string, unknown>> {
    try {
      const file = await this.files.findById(fileId, orgId);
      let downloadUrl: string | null = null;
      let downloadUrlExpiresIn: number | null = null;
      if (includeDownloadUrl && this.signedUrls) {
        try {
          const signed = await this.signedUrls.generateSignedUrl(fileId);
          downloadUrl = signed.url;
          downloadUrlExpiresIn = signed.expiresIn;
        } catch (error) {
          this.logger.warn(
            `Signed URL for webhook failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      return {
        originalFileName: file.originalFilename,
        mimeType: file.mimeType,
        size: file.size,
        downloadUrl,
        downloadUrlExpiresIn,
      };
    } catch (error) {
      this.logger.warn(
        `File meta for webhook failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        originalFileName: null,
        mimeType: null,
        size: null,
        downloadUrl: null,
        downloadUrlExpiresIn: null,
      };
    }
  }

  private async deliver(
    url: string,
    settings: NotifySettings,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; statusCode: number; responseText: string }> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'storage-service-notify-webhook',
    };

    if (Array.isArray(settings.headers)) {
      for (const header of settings.headers) {
        const name = header?.name?.trim();
        if (!name) continue;
        // Don't let custom headers override Content-Type / signature
        if (/^content-type$/i.test(name)) continue;
        headers[name] = String(header.value ?? '');
      }
    }

    const bearer = settings.bearerToken?.trim();
    if (bearer) {
      headers.Authorization = bearer.toLowerCase().startsWith('bearer ')
        ? bearer
        : `Bearer ${bearer}`;
    }

    if (typeof settings.secret === 'string' && settings.secret.trim()) {
      headers['X-Storage-Signature'] = createHmac('sha256', settings.secret)
        .update(body)
        .digest('hex');
    }

    this.logger.log(`POST ${url} event=${String(payload.event ?? '')}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      const responseText = await response.text().catch(() => '');
      return {
        ok: response.ok,
        statusCode: response.status,
        responseText,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Webhook request failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }
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
