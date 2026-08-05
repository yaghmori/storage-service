import { Injectable, Logger } from '@nestjs/common';
import {
  ProcessorKey,
  type AiVisionProcessorSettings,
  DEFAULT_AI_VISION_SYSTEM_PROMPT,
} from '@workspace/validation';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/services/variants.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { OpenaiCompatibleClient } from './openai-compatible.client';
import { ProcessorBackendsService } from './processor-backends.service';

const AI_VISION_SCHEMA_VERSION = 1;
const VISION_MAX_EDGE = 1280;

type SharpModule = typeof import('sharp');

@Injectable()
export class AiVisionProcessingService {
  private readonly logger = new Logger(AiVisionProcessingService.name);
  private sharpModule: SharpModule | null | undefined;

  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly backends: ProcessorBackendsService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
    private readonly openai: OpenaiCompatibleClient,
  ) {}

  async process(input: {
    fileId: string;
    orgId: string;
    jobId?: string;
    backendId?: string | null;
    settings: AiVisionProcessorSettings;
  }) {
    const file = await this.filesService.findById(input.fileId, input.orgId);
    const resolved = await this.backends.resolveOpenaiCompatible(
      input.orgId,
      input.backendId,
    );

    if (!resolved) {
      await this.log(input.jobId, 'warn', 'No OpenAI-compatible backend configured');
      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.AI_VISION,
        status: 'skipped',
        schemaVersion: AI_VISION_SCHEMA_VERSION,
        data: {},
        error: 'No OpenAI-compatible backend configured',
        jobId: input.jobId ?? null,
        processedAt: new Date(),
      });
      return { skipped: true, reason: 'no_backend' };
    }

    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.AI_VISION,
      status: 'processing',
      schemaVersion: AI_VISION_SCHEMA_VERSION,
      backendId: resolved.backendId,
      backendKind: resolved.kind,
      model: resolved.visionModel,
      data: {},
      error: null,
      jobId: input.jobId ?? null,
    });

    if (!file.mimeType?.startsWith('image/')) {
      throw new Error(`ai.vision requires an image; got ${file.mimeType}`);
    }

    await this.log(
      input.jobId,
      'info',
      `Preparing JPEG for vision (source mime ${file.mimeType})`,
    );
    const jpegBuffer = await this.loadVisionJpeg(input.fileId);
    const dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
    await this.log(
      input.jobId,
      'info',
      `Encoded vision payload ${(jpegBuffer.length / 1024).toFixed(1)} KB JPEG`,
    );

    const wants = {
      caption: input.settings.enableCaption !== false,
      tags: input.settings.enableTags !== false,
      nsfw: input.settings.enableNsfw !== false,
    };

    const customUser = input.settings.userPrompt?.trim();
    const userText =
      customUser && customUser.length > 0
        ? customUser
        : [
            'Analyze this image.',
            wants.caption
              ? 'Include description.'
              : 'Set description to empty string.',
            wants.tags ? 'Include tags (3-10).' : 'Set tags to [].',
            wants.nsfw
              ? 'Include nsfwScore and isNsfw.'
              : 'Set nsfwScore to null and isNsfw to false.',
          ].join(' ');

    const systemPrompt =
      input.settings.systemPrompt?.trim() || DEFAULT_AI_VISION_SYSTEM_PROMPT;

    const model = this.backends.resolveModel({
      role: 'vision',
      processorModels: input.settings.models,
      backend: resolved,
    });

    await this.log(
      input.jobId,
      'info',
      `Calling ${resolved.source} model "${model}" at ${resolved.baseUrl}`,
    );

    // Many local OpenAI-compatible servers (Ollama / llama.cpp) reject
    // response_format and/or WebP. We send JPEG and ask for JSON in the prompt.
    const raw = await this.openai.chatCompletions({
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      model,
      timeoutMs: resolved.timeoutMs,
      responseFormatJson: false,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    await this.log(
      input.jobId,
      'info',
      `Model response received (${raw.length} chars)`,
    );

    const parsed = this.parseResult(raw, input.settings);
    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.AI_VISION,
      status: 'completed',
      schemaVersion: AI_VISION_SCHEMA_VERSION,
      backendId: resolved.backendId,
      backendKind: resolved.kind,
      model,
      data: parsed,
      jobId: input.jobId ?? null,
      processedAt: new Date(),
      error: null,
    });

    if (input.jobId) {
      await this.jobs.setOutput(input.jobId, parsed);
    }

    this.logger.log(
      `ai.vision completed for file ${input.fileId} via ${resolved.source} backend`,
    );
    await this.log(input.jobId, 'info', 'ai.vision completed');
    return { skipped: false, data: parsed };
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
      throw new Error(`Image processing unavailable for ai.vision: ${message}`);
    }
  }

  /**
   * Local vision backends often fail on WebP (and mismatched data-URL mime).
   * Always normalize to a bounded JPEG before chat/completions.
   */
  private async loadVisionJpeg(fileId: string): Promise<Buffer> {
    const provider = await this.filesService.getFileProvider(fileId);
    try {
      const variants = await this.variantsService.findByFileId(fileId);
      const normalized = variants.find((v) => v.name === 'normalized');
      if (normalized) {
        const bytes = await provider.download(normalized.key);
        // Already JPEG from normalize; still re-encode for max edge.
        const sharp = await this.getSharp();
        return sharp(bytes)
          .rotate()
          .resize({
            width: VISION_MAX_EDGE,
            height: VISION_MAX_EDGE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
      }
    } catch (error) {
      this.logger.warn(
        `normalized variant unavailable for vision: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const original = await this.filesService.getFileStream(fileId);
    const sharp = await this.getSharp();
    return sharp(original)
      .rotate()
      .resize({
        width: VISION_MAX_EDGE,
        height: VISION_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  }

  private async log(
    jobId: string | undefined,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
  ) {
    if (!jobId) return;
    try {
      await this.jobs.appendLog(jobId, level, message);
    } catch (error) {
      this.logger.warn(
        `Failed to append job log: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private parseResult(
    raw: string,
    settings: AiVisionProcessorSettings,
  ): Record<string, unknown> {
    let jsonText = raw.trim();
    const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) jsonText = fence[1].trim();

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      throw new Error(`Failed to parse AI vision JSON: ${raw.slice(0, 200)}`);
    }

    const description =
      settings.enableCaption === false
        ? ''
        : typeof obj.description === 'string'
          ? obj.description
          : '';
    const tags =
      settings.enableTags === false
        ? []
        : Array.isArray(obj.tags)
          ? obj.tags.filter((t): t is string => typeof t === 'string').slice(0, 20)
          : [];

    let nsfwScore: number | null = null;
    let isNsfw = false;
    if (settings.enableNsfw !== false) {
      const score =
        typeof obj.nsfwScore === 'number'
          ? obj.nsfwScore
          : typeof obj.nsfw_score === 'number'
            ? obj.nsfw_score
            : null;
      nsfwScore =
        score == null ? null : Math.min(1, Math.max(0, score));
      const threshold = settings.nsfwThreshold ?? 0.7;
      if (typeof obj.isNsfw === 'boolean') {
        isNsfw = obj.isNsfw;
      } else if (nsfwScore != null) {
        isNsfw = nsfwScore >= threshold;
      }
    }

    return { description, tags, nsfwScore, isNsfw };
  }
}
