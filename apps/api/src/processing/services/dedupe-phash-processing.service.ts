import { Injectable, Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { FilesRepository } from '../../files/repositories/files.repository';
import { FileDuplicationService } from '../../files/services/file-duplication.service';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/services/variants.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';

type SharpModule = typeof import('sharp');

@Injectable()
export class DedupePhashProcessingService {
  private readonly logger = new Logger(DedupePhashProcessingService.name);
  private sharpModule: SharpModule | null | undefined;

  constructor(
    private readonly filesService: FilesService,
    private readonly filesRepository: FilesRepository,
    private readonly variantsService: VariantsService,
    private readonly duplication: FileDuplicationService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
  ) {}

  async process(input: {
    fileId: string;
    orgId: string;
    jobId?: string;
    settings?: { thresholdBits?: number };
  }) {
    const threshold = input.settings?.thresholdBits ?? 10;
    const file = await this.filesService.findById(input.fileId, input.orgId);
    if (!file.mimeType?.startsWith('image/')) {
      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.DEDUPE_PHASH,
        status: 'skipped',
        data: { reason: 'not_image' },
        jobId: input.jobId ?? null,
        processedAt: new Date(),
      });
      return { skipped: true };
    }

    await this.log(input.jobId, 'info', 'Computing perceptual hash');
    const buffer = await this.loadImageBuffer(input.fileId, file.key);
    const perceptualHash = await this.computeDHash(buffer);
    await this.filesRepository.updatePerceptualHash(
      input.fileId,
      perceptualHash,
    );

    const candidates = await this.filesRepository.findRecentWithPerceptualHash(
      input.orgId,
      input.fileId,
      500,
    );

    const matches: Array<{
      fileId: string;
      distance: number;
      similarityScore: number;
    }> = [];
    for (const candidate of candidates) {
      if (!candidate.perceptualHash) continue;
      const distance = this.hamming(perceptualHash, candidate.perceptualHash);
      if (distance <= threshold) {
        const similarityScore = Number((1 - distance / 64).toFixed(4));
        matches.push({
          fileId: candidate.id,
          distance,
          similarityScore,
        });
        await this.duplication.flagContentNearDuplicate({
          originalFileId: candidate.id,
          duplicateFileId: input.fileId,
          orgId: input.orgId,
          similarityScore,
        });
      }
    }

    const data = {
      perceptualHash,
      thresholdBits: threshold,
      matches,
    };
    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.DEDUPE_PHASH,
      status: 'completed',
      data,
      jobId: input.jobId ?? null,
      processedAt: new Date(),
      error: null,
    });
    if (input.jobId) await this.jobs.setOutput(input.jobId, data);
    await this.log(
      input.jobId,
      'info',
      `pHash=${perceptualHash}; matches=${matches.length}`,
    );
    return { skipped: false, data };
  }

  private async loadImageBuffer(fileId: string, originalKey: string) {
    const provider = await this.filesService.getFileProvider(fileId);
    try {
      const normalized = await this.variantsService.findByFileIdAndType(
        fileId,
        'normalized',
      );
      if (normalized) return provider.download(normalized.key);
    } catch (error) {
      this.logger.warn(`normalized variant fallback: ${error}`);
    }
    return provider.download(originalKey);
  }

  private async computeDHash(buffer: Buffer): Promise<string> {
    const sharp = await this.getSharp();
    const { data, info } = await sharp(buffer)
      .greyscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    let bits = '';
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < width - 1; x++) {
        const left = data[y * width + x]!;
        const right = data[y * width + x + 1]!;
        bits += left < right ? '1' : '0';
      }
    }
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex.padStart(16, '0');
  }

  private hamming(left: string, right: string): number {
    let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
    let distance = 0;
    while (value) {
      distance += Number(value & 1n);
      value >>= 1n;
    }
    return distance;
  }

  private async getSharp(): Promise<SharpModule> {
    if (this.sharpModule !== undefined) {
      if (!this.sharpModule) throw new Error('sharp unavailable');
      return this.sharpModule;
    }
    const mod = await import('sharp');
    this.sharpModule = (mod.default ?? mod) as SharpModule;
    return this.sharpModule;
  }

  private async log(
    jobId: string | undefined,
    level: 'info' | 'warn' | 'error',
    message: string,
  ) {
    if (!jobId) return;
    await this.jobs.appendLog(jobId, level, message).catch(() => undefined);
  }
}
