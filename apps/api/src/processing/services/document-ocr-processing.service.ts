import { Injectable, Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { execFile } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/services/variants.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { OpenaiCompatibleClient } from './openai-compatible.client';
import { ProcessorBackendsService } from './processor-backends.service';

const execFileAsync = promisify(execFile);
const OCR_MAX_EDGE = 2048;

type SharpModule = typeof import('sharp');

@Injectable()
export class DocumentOcrProcessingService {
  private readonly logger = new Logger(DocumentOcrProcessingService.name);
  private sharpModule: SharpModule | null | undefined;

  constructor(
    private readonly files: FilesService,
    private readonly variants: VariantsService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
    private readonly backends: ProcessorBackendsService,
    private readonly openai: OpenaiCompatibleClient,
  ) {}

  async process(input: {
    fileId: string;
    orgId: string;
    jobId?: string;
    backendId?: string | null;
    settings?: {
      minCharsBeforeSkip?: number;
      engine?: 'openai_compatible' | 'tesseract';
      models?: { vision?: string };
      model?: string;
    };
  }) {
    const minChars = input.settings?.minCharsBeforeSkip ?? 100;
    const engine = input.settings?.engine ?? 'openai_compatible';
    const extracted = await this.results.findByFileAndProcessor(
      input.fileId,
      ProcessorKey.DOCUMENT_TEXT,
    );
    const extractedText =
      extracted?.data &&
      typeof extracted.data === 'object' &&
      typeof (extracted.data as Record<string, unknown>).text === 'string'
        ? ((extracted.data as Record<string, unknown>).text as string)
        : '';
    if (extractedText.trim().length >= minChars) {
      return this.skip(
        input,
        `Skipped OCR: document.text already has ≥${minChars} characters`,
      );
    }

    const file = await this.files.findById(input.fileId, input.orgId);
    const jpeg = await this.loadOcrJpeg(input.fileId, file.mimeType, input.jobId);
    if (!jpeg) {
      return this.skip(
        input,
        file.mimeType.toLowerCase() === 'application/pdf'
          ? 'Skipped OCR: no page image — PDF preview (pdftoppm) must succeed first'
          : 'Skipped OCR: no raster image available for this file',
      );
    }

    if (engine === 'tesseract') {
      const text = await this.runTesseract(jpeg);
      if (text == null) {
        return this.skip(
          input,
          'Skipped OCR: tesseract binary is not available on this worker',
        );
      }
      return this.complete(input, {
        text,
        charCount: text.length,
        pageCount: 1,
        model: 'tesseract',
        engine: 'tesseract',
      });
    }

    const backend = await this.backends.resolveOpenaiCompatible(
      input.orgId,
      input.backendId,
    );
    if (!backend) {
      // Fall back to local tesseract when no vision backend is configured
      const text = await this.runTesseract(jpeg);
      if (text != null) {
        return this.complete(input, {
          text,
          charCount: text.length,
          pageCount: 1,
          model: 'tesseract',
          engine: 'tesseract',
        });
      }
      return this.skip(
        input,
        'Skipped OCR: no OpenAI-compatible vision backend and tesseract is not available',
      );
    }

    const model = this.backends.resolveModel({
      role: 'vision',
      jobOverride:
        typeof input.settings?.model === 'string'
          ? input.settings.model
          : null,
      processorModels: input.settings?.models,
      backend,
    });

    await this.log(
      input.jobId,
      'info',
      `OCR vision payload ${(jpeg.length / 1024).toFixed(1)} KB JPEG via ${model}`,
    );

    const raw = await this.openai.chatCompletions({
      baseUrl: backend.baseUrl,
      apiKey: backend.apiKey,
      model,
      timeoutMs: backend.timeoutMs,
      responseFormatJson: false,
      messages: [
        {
          role: 'system',
          content:
            'Extract all visible text from the document image. Return only JSON: {"text":"..."}',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'OCR this document page.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
              },
            },
          ],
        },
      ],
    });

    let text = '';
    try {
      const json = this.parseJson(raw);
      text = typeof json.text === 'string' ? json.text : raw;
    } catch {
      text = raw;
    }

    return this.complete(
      input,
      {
        text,
        charCount: text.length,
        pageCount: 1,
        model,
        engine: 'openai_compatible',
      },
      {
        backendId: backend.backendId,
        backendKind: backend.kind,
        model,
      },
    );
  }

  /**
   * Vision backends often reject WebP/AVIF and mismatched data-URL mimes.
   * Prefer normalized → thumbnail → original image, then re-encode to JPEG.
   */
  private async loadOcrJpeg(
    fileId: string,
    mimeType: string,
    jobId?: string,
  ): Promise<Buffer | null> {
    const provider = await this.files.getFileProvider(fileId);
    const candidates: Array<{ label: string; key: string }> = [];

    const normalized = await this.variants.findByFileIdAndType(
      fileId,
      'normalized',
    );
    if (normalized?.key) {
      candidates.push({ label: 'normalized', key: normalized.key });
    }
    const thumbnail = await this.variants.findByFileIdAndType(
      fileId,
      'thumbnail',
    );
    if (thumbnail?.key) {
      candidates.push({ label: 'thumbnail', key: thumbnail.key });
    }
    if (mimeType.startsWith('image/')) {
      const file = await this.files.findById(fileId);
      candidates.push({ label: 'original', key: file.key });
    }

    if (candidates.length === 0) return null;

    const sharp = await this.getSharp();
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const bytes = await provider.download(candidate.key);
        const jpeg = await sharp(bytes)
          .rotate()
          .resize({
            width: OCR_MAX_EDGE,
            height: OCR_MAX_EDGE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
        await this.log(
          jobId,
          'info',
          `Prepared OCR JPEG from ${candidate.label} (${(jpeg.length / 1024).toFixed(1)} KB)`,
        );
        return jpeg;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `OCR source ${candidate.label} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to prepare OCR JPEG');
  }

  private async getSharp(): Promise<SharpModule> {
    if (this.sharpModule !== undefined) {
      if (!this.sharpModule) {
        throw new Error('sharp is not available in this runtime');
      }
      return this.sharpModule;
    }
    try {
      const mod = await import('sharp');
      this.sharpModule = (mod.default ?? mod) as SharpModule;
      return this.sharpModule;
    } catch (error) {
      this.sharpModule = null;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Image processing unavailable for document.ocr: ${message}`);
    }
  }

  private async runTesseract(image: Buffer): Promise<string | null> {
    const dir = await mkdtemp(join(tmpdir(), 'document-ocr-'));
    const imagePath = join(dir, 'page.jpg');
    try {
      await writeFile(imagePath, image);
      try {
        const { stdout } = await execFileAsync(
          'tesseract',
          [imagePath, 'stdout', '-l', 'eng'],
          { maxBuffer: 16 * 1024 * 1024 },
        );
        return stdout;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async complete(
    input: { fileId: string; orgId: string; jobId?: string },
    data: Record<string, unknown>,
    meta?: { backendId?: string; backendKind?: string; model?: string },
  ) {
    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.DOCUMENT_OCR,
      status: 'completed',
      backendId: meta?.backendId ?? null,
      backendKind: meta?.backendKind ?? null,
      model: meta?.model ?? null,
      data,
      jobId: input.jobId ?? null,
      processedAt: new Date(),
    });
    if (input.jobId) {
      await this.jobs.appendLog(
        input.jobId,
        'info',
        `OCR extracted ${data.charCount} characters via ${data.engine}`,
      );
      await this.jobs.setOutput(input.jobId, {
        charCount: data.charCount,
        model: data.model,
        engine: data.engine,
      });
    }
    return { skipped: false, data };
  }

  private parseJson(raw: string): Record<string, unknown> {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? raw;
    return JSON.parse(fenced.trim()) as Record<string, unknown>;
  }

  private async skip(
    input: { fileId: string; orgId: string; jobId?: string },
    error: string,
  ) {
    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.DOCUMENT_OCR,
      status: 'skipped',
      data: {},
      error,
      jobId: input.jobId ?? null,
      processedAt: new Date(),
    });
    if (input.jobId) await this.jobs.appendLog(input.jobId, 'warn', error);
    return { skipped: true, error };
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
