import { Injectable, Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { QueuesService } from '../../queues/queues.service';
import { mimeMatches, DEFAULT_MIME_INCLUDE } from '../constants/processor-keys';
import { OrgProcessorsService } from './org-processors.service';

@Injectable()
export class ProcessorSchedulerService {
  private readonly logger = new Logger(ProcessorSchedulerService.name);

  constructor(
    private readonly orgProcessors: OrgProcessorsService,
    private readonly queues: QueuesService,
  ) {}

  async scheduleForFile(input: {
    fileId: string;
    orgId: string;
    mimeType: string;
    originalFileName?: string;
    /** When set, only these processor keys are considered (still must be enabled + MIME-compatible). */
    onlyKeys?: string[];
  }): Promise<{ scheduled: string[] }> {
    const scheduled: string[] = [];
    const only = input.onlyKeys?.length
      ? new Set(input.onlyKeys)
      : null;
    const processors = (
      await this.orgProcessors.getEnabledForFile(input.orgId, input.mimeType)
    )
      .filter((p) => p.processorKey !== ProcessorKey.NOTIFY_WEBHOOK)
      .filter((p) => (only ? only.has(p.processorKey) : true))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const proc of processors) {
      try {
        if (
          proc.processorKey === ProcessorKey.IMAGE_VARIANTS &&
          !this.shouldQueueImageVariants(input.mimeType, input.originalFileName)
        ) {
          continue;
        }

        const settings = (proc.settings ?? {}) as Record<string, unknown>;

        if (proc.processorKey === ProcessorKey.IMAGE_NORMALIZE) {
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            backendId: proc.backendId,
            parameters: settings,
            data: {
              fileId: input.fileId,
              orgId: input.orgId,
              settings,
            },
            priority: 0,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.SECURITY_VIRUS_SCAN) {
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            backendId: proc.backendId,
            parameters: settings,
            data: {
              fileId: input.fileId,
              orgId: input.orgId,
              backendId: proc.backendId,
              settings,
            },
            priority: 0,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.IMAGE_VARIANTS) {
          const { variants, formats } =
            this.orgProcessors.getImageVariantSlots(settings);
          if (variants.length === 0) continue;
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            backendId: proc.backendId,
            parameters: { variants, formats },
            data: {
              fileId: input.fileId,
              orgId: input.orgId,
              options: { variants, formats },
            },
            priority: 1,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.VIDEO_PREVIEW) {
          const options = this.orgProcessors.getVideoOptions(settings);
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            backendId: proc.backendId,
            parameters: options,
            data: {
              fileId: input.fileId,
              orgId: input.orgId,
              options,
            },
            priority: 1,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.METADATA_EXIF) {
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            backendId: proc.backendId,
            parameters: {},
            data: { fileId: input.fileId, orgId: input.orgId },
            priority: 2,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.AI_VISION) {
          const aiSettings = this.orgProcessors.getAiVisionSettings(settings);
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            backendId: proc.backendId,
            parameters: aiSettings as Record<string, unknown>,
            data: {
              fileId: input.fileId,
              orgId: input.orgId,
              backendId: proc.backendId,
              settings: aiSettings,
            },
            priority: 3,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.DEDUPE_PHASH) {
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            parameters: settings,
            data: { fileId: input.fileId, orgId: input.orgId, settings },
            priority: 3,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.INTEGRITY_VERIFY) {
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            parameters: {},
            data: { fileId: input.fileId, orgId: input.orgId },
            priority: 5,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.DOCUMENT_PREVIEW) {
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            parameters: settings,
            data: { fileId: input.fileId, orgId: input.orgId, settings },
            priority: 4,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.DOCUMENT_TEXT) {
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            parameters: settings,
            data: { fileId: input.fileId, orgId: input.orgId, settings },
            priority: 4,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        if (proc.processorKey === ProcessorKey.DOCUMENT_OCR) {
          // PDFs need document.preview first (pdftoppm → page JPEG).
          // Images can OCR immediately from the original bytes.
          if (input.mimeType.toLowerCase() === 'application/pdf') {
            this.logger.debug(
              `Deferring document.ocr for PDF ${input.fileId} until preview completes`,
            );
            continue;
          }
          await this.queues.enqueueProcessorJob({
            processorKey: proc.processorKey,
            fileId: input.fileId,
            orgId: input.orgId,
            backendId: proc.backendId,
            parameters: settings,
            data: {
              fileId: input.fileId,
              orgId: input.orgId,
              backendId: proc.backendId,
              settings,
            },
            priority: 4,
          });
          scheduled.push(proc.processorKey);
          continue;
        }

        this.logger.warn(
          `No scheduler handler for processor_key=${proc.processorKey}; skipping`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to enqueue ${proc.processorKey} for file ${input.fileId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return { scheduled };
  }

  /** Called after successful document.preview for PDFs. */
  async enqueueDocumentOcrAfterPreview(input: {
    fileId: string;
    orgId: string;
  }): Promise<boolean> {
    const enabled = await this.orgProcessors.getEnabledForFile(
      input.orgId,
      'application/pdf',
    );
    const ocr = enabled.find((p) => p.processorKey === ProcessorKey.DOCUMENT_OCR);
    if (!ocr) return false;

    const settings = (ocr.settings ?? {}) as Record<string, unknown>;
    await this.queues.enqueueProcessorJob({
      processorKey: ProcessorKey.DOCUMENT_OCR,
      fileId: input.fileId,
      orgId: input.orgId,
      backendId: ocr.backendId,
      parameters: settings,
      data: {
        fileId: input.fileId,
        orgId: input.orgId,
        backendId: ocr.backendId,
        settings,
      },
      priority: 4,
    });
    this.logger.log(
      `Enqueued document.ocr after preview for file ${input.fileId}`,
    );
    return true;
  }

  private shouldQueueImageVariants(
    mimetype: string,
    originalFileName?: string,
  ): boolean {
    const name = (originalFileName || '').toLowerCase();
    if (name.endsWith('.psd') || name.endsWith('.psb')) {
      return false;
    }
    if (
      mimetype === 'image/vnd.adobe.photoshop' ||
      mimetype === 'image/x-photoshop' ||
      mimetype === 'image/psd' ||
      mimetype === 'image/photoshop'
    ) {
      return false;
    }
    return mimeMatches(
      mimetype,
      DEFAULT_MIME_INCLUDE[ProcessorKey.IMAGE_VARIANTS],
    );
  }
}
