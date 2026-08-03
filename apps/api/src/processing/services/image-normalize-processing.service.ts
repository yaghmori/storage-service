import { Injectable, Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { extname } from 'path';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/services/variants.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';

type SharpModule = typeof import('sharp');

@Injectable()
export class ImageNormalizeProcessingService {
  private readonly logger = new Logger(ImageNormalizeProcessingService.name);
  private sharpModule: SharpModule | null | undefined;

  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
  ) {}

  async process(input: {
    fileId: string;
    orgId: string;
    jobId?: string;
    settings?: { forceAllImages?: boolean; maxEdge?: number };
  }) {
    const file = await this.filesService.findById(input.fileId, input.orgId);
    const mime = (file.mimeType || '').toLowerCase();
    const maxEdge = input.settings?.maxEdge ?? 2048;
    const force = input.settings?.forceAllImages === true;

    const needsNormalize =
      force ||
      mime === 'image/heic' ||
      mime === 'image/heif' ||
      mime === 'image/gif' ||
      mime.includes('heic') ||
      mime.includes('heif');

    if (!needsNormalize) {
      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.IMAGE_NORMALIZE,
        status: 'skipped',
        data: { reason: 'mime_not_targeted' },
        jobId: input.jobId ?? null,
        processedAt: new Date(),
        error: null,
      });
      return { skipped: true };
    }

    await this.log(input.jobId, 'info', `Normalizing ${mime}`);
    const provider = await this.filesService.getFileProvider(input.fileId);
    let buffer = await provider.download(file.key);
    const sharp = await this.getSharp();

    // HEIC/HEIF: try sharp first; fall back to heic-convert when libheif is missing
    if (mime.includes('heic') || mime.includes('heif')) {
      try {
        await sharp(buffer).metadata();
      } catch {
        buffer = await this.convertHeicToJpeg(buffer);
        await this.log(input.jobId, 'info', 'Decoded HEIC via heic-convert fallback');
      }
    }

    const meta = await sharp(buffer, { animated: true }).metadata();
    const frameCount = meta.pages ?? 1;
    const animated = frameCount > 1;

    const jpeg = await sharp(buffer, { pages: 1 })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    const prior = await this.variantsService.findByFileIdAndType(
      input.fileId,
      'normalized',
    );
    if (prior) {
      await provider.delete(prior.key).catch(() => undefined);
      await this.variantsService.delete(prior.id);
    }

    const baseKey = file.key.replace(extname(file.key), '');
    const variantKey = `${baseKey}_normalized.jpg`;
    await provider.upload(variantKey, jpeg, 'image/jpeg');
    const outputMeta = await sharp(jpeg).metadata();
    await this.variantsService.create({
      fileId: input.fileId,
      variantType: 'normalized',
      variantKey,
      storageProviderId: file.storageProviderId,
      size: BigInt(jpeg.length),
      format: 'jpeg',
      width: outputMeta.width ?? null,
      height: outputMeta.height ?? null,
      quality: 88,
    });

    const data = {
      animated,
      frameCount,
      format: 'jpeg',
      mimeType: 'image/jpeg',
      variantKey,
    };
    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.IMAGE_NORMALIZE,
      status: 'completed',
      data,
      jobId: input.jobId ?? null,
      processedAt: new Date(),
      error: null,
    });
    if (input.jobId) await this.jobs.setOutput(input.jobId, data);
    await this.log(input.jobId, 'info', 'Normalized JPEG variant written');
    this.logger.log(`Normalized image ${input.fileId}`);
    return { skipped: false, data };
  }

  private async convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
    try {
      const heicConvert = (await import('heic-convert')).default as (opts: {
        buffer: Buffer;
        format: 'JPEG' | 'PNG';
        quality?: number;
      }) => Promise<ArrayBuffer>;
      const out = await heicConvert({
        buffer,
        format: 'JPEG',
        quality: 0.9,
      });
      return Buffer.from(out);
    } catch (error) {
      throw new Error(
        `HEIC decode failed (install libheif in the image or heic-convert): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async getSharp(): Promise<SharpModule> {
    if (this.sharpModule !== undefined) {
      if (!this.sharpModule) throw new Error('sharp unavailable');
      return this.sharpModule;
    }
    try {
      const mod = await import('sharp');
      this.sharpModule = (mod.default ?? mod) as SharpModule;
      return this.sharpModule;
    } catch (error) {
      this.sharpModule = null;
      throw new Error(
        `sharp unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async log(
    jobId: string | undefined,
    level: 'info' | 'warn' | 'error',
    message: string,
  ) {
    if (!jobId) return;
    try {
      await this.jobs.appendLog(jobId, level, message);
    } catch (error) {
      this.logger.warn(`log failed: ${error}`);
    }
  }
}
