import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  DEFAULT_NOTIFY_WEBHOOK_SETTINGS,
  NOTIFY_WEBHOOK_EVENTS,
  normalizeNotifyWebhookDestinations,
  resolveNotifyWebhookDownloadUrlExpiresIn,
  ProcessorKey,
  type NotifyWebhookDestination,
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

type Destination = NotifyWebhookDestination & { id: string };

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
    const destinations = normalizeNotifyWebhookDestinations(settings).filter(
      (dest) => dest.enabled !== false && !!dest.url?.trim(),
    );

    if (destinations.length === 0) {
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
    const matched = destinations.filter((dest) =>
      this.resolveEvents(dest.events).includes(event),
    );

    if (matched.length === 0) {
      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.NOTIFY_WEBHOOK,
        status: 'skipped',
        data: { reason: 'event_filtered', event, destinations: destinations.length },
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

    const basePayload = {
      event,
      fileId: input.fileId,
      orgId: input.orgId,
      processingStatus: input.processingStatus,
      processingError: input.processingError ?? null,
      processorSummary,
      sentAt: new Date().toISOString(),
    };

    const deliveries: Array<{
      id: string;
      name: string;
      url: string;
      ok: boolean;
      statusCode: number;
      error?: string;
    }> = [];

    for (const dest of matched) {
      const fileMeta = await this.buildFileMeta(
        input.fileId,
        input.orgId,
        dest.includeDownloadUrl !== false,
        resolveNotifyWebhookDownloadUrlExpiresIn(dest.downloadUrlExpiresIn),
      );
      const payload = { ...basePayload, file: fileMeta, destinationId: dest.id };
      try {
        const result = await this.deliver(dest.url!.trim(), dest, payload);
        await this.log(
          input.jobId,
          result.ok ? 'info' : 'error',
          `${dest.name || dest.id} → HTTP ${result.statusCode}: ${result.responseText.slice(0, 200)}`,
        );
        deliveries.push({
          id: dest.id,
          name: dest.name || dest.id,
          url: dest.url!.trim(),
          ok: result.ok,
          statusCode: result.statusCode,
          error: result.ok
            ? undefined
            : result.responseText.slice(0, 300) || `HTTP ${result.statusCode}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.log(input.jobId, 'error', `${dest.name || dest.id} → ${message}`);
        deliveries.push({
          id: dest.id,
          name: dest.name || dest.id,
          url: dest.url!.trim(),
          ok: false,
          statusCode: 0,
          error: message,
        });
      }
    }

    const failed = deliveries.filter((d) => !d.ok);
    const data = {
      event,
      destinations: deliveries,
      succeeded: deliveries.length - failed.length,
      failed: failed.length,
    };

    if (failed.length > 0) {
      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.NOTIFY_WEBHOOK,
        status: 'failed',
        data,
        error: failed
          .map((d) => `${d.name}: ${d.error ?? `HTTP ${d.statusCode}`}`)
          .join('; ')
          .slice(0, 1000),
        jobId: input.jobId ?? null,
        processedAt: new Date(),
      });
      if (input.jobId) await this.jobs.setOutput(input.jobId, data);
      throw new Error(
        `Webhook failed for ${failed.length}/${deliveries.length} destination(s)`,
      );
    }

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
   * Fire a sample webhook to one destination (by id or inline override).
   */
  async sendTest(input: {
    orgId: string;
    destinationId?: string | null;
    destination?: Partial<NotifyWebhookDestination> | null;
    event?: NotifyWebhookEvent;
    fileId?: string | null;
  }) {
    const saved = await this.loadSettings(input.orgId, { requireEnabled: false });
    const destinations = normalizeNotifyWebhookDestinations(saved);

    let dest: Destination | null = null;
    if (input.destination?.url?.trim()) {
      dest = {
        id: input.destination.id?.trim() || 'test',
        name: input.destination.name || 'Test',
        enabled: true,
        url: input.destination.url.trim(),
        secret: input.destination.secret ?? '',
        bearerToken: input.destination.bearerToken ?? '',
        headers: input.destination.headers ?? [],
        events: input.destination.events ?? [...NOTIFY_WEBHOOK_EVENTS],
        includeDownloadUrl: input.destination.includeDownloadUrl !== false,
        downloadUrlExpiresIn: input.destination.downloadUrlExpiresIn,
      };
    } else if (input.destinationId) {
      dest =
        destinations.find((d) => d.id === input.destinationId) ?? null;
    } else if (destinations.length === 1) {
      dest = destinations[0]!;
    }

    if (!dest?.url?.trim()) {
      throw new BadRequestException(
        'Webhook destination URL is required (pick a destination or pass url)',
      );
    }

    const event =
      input.event &&
      (NOTIFY_WEBHOOK_EVENTS as readonly string[]).includes(input.event)
        ? input.event
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
        dest.includeDownloadUrl !== false,
        resolveNotifyWebhookDownloadUrlExpiresIn(dest.downloadUrlExpiresIn),
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
        { processorKey: 'metadata.exif', status: 'completed', error: null },
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
      destinationId: dest.id,
      sample: true,
      sentAt: new Date().toISOString(),
    };

    const delivery = await this.deliver(dest.url.trim(), dest, payload);
    return {
      ok: delivery.ok,
      statusCode: delivery.statusCode,
      url: dest.url.trim(),
      destinationId: dest.id,
      destinationName: dest.name || dest.id,
      event,
      responsePreview: delivery.responseText.slice(0, 500),
      payload,
    };
  }

  private async loadSettings(
    orgId: string,
    options?: { requireEnabled?: boolean },
  ): Promise<NotifyWebhookProcessorSettings> {
    const requireEnabled = options?.requireEnabled !== false;
    const processor = (await this.orgProcessors.ensureDefaults(orgId)).find(
      (row) =>
        row.processorKey === ProcessorKey.NOTIFY_WEBHOOK &&
        (!requireEnabled || row.enabled),
    );
    return {
      ...DEFAULT_NOTIFY_WEBHOOK_SETTINGS,
      ...((processor?.settings ?? {}) as NotifyWebhookProcessorSettings),
    };
  }

  private resolveEvents(
    events: NotifyWebhookDestination['events'],
  ): NotifyWebhookEvent[] {
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
    downloadUrlExpiresIn?: number,
  ): Promise<Record<string, unknown>> {
    try {
      const file = await this.files.findById(fileId, orgId);
      let downloadUrl: string | null = null;
      let expiresIn: number | null = null;
      if (includeDownloadUrl && this.signedUrls) {
        try {
          const signed = await this.signedUrls.generateSignedUrl(
            fileId,
            undefined,
            downloadUrlExpiresIn,
          );
          downloadUrl = signed.url;
          expiresIn = signed.expiresIn;
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
        downloadUrlExpiresIn: expiresIn,
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
    dest: NotifyWebhookDestination,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; statusCode: number; responseText: string }> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'storage-service-notify-webhook',
    };

    if (Array.isArray(dest.headers)) {
      for (const header of dest.headers) {
        const name = header?.name?.trim();
        if (!name) continue;
        if (/^content-type$/i.test(name)) continue;
        headers[name] = String(header.value ?? '');
      }
    }

    const bearer = dest.bearerToken?.trim();
    if (bearer) {
      headers.Authorization = bearer.toLowerCase().startsWith('bearer ')
        ? bearer
        : `Bearer ${bearer}`;
    }

    if (typeof dest.secret === 'string' && dest.secret.trim()) {
      headers['X-Storage-Signature'] = createHmac('sha256', dest.secret)
        .update(body)
        .digest('hex');
    }

    this.logger.log(
      `POST ${url} event=${String(payload.event ?? '')} dest=${dest.id ?? ''}`,
    );
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
      const message = error instanceof Error ? error.message : String(error);
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
