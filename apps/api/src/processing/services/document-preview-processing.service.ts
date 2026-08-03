import { Injectable } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { execFile } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { promisify } from 'util';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/services/variants.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';

const execFileAsync = promisify(execFile);

@Injectable()
export class DocumentPreviewProcessingService {
  constructor(
    private readonly files: FilesService,
    private readonly variants: VariantsService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
  ) {}

  async process(input: { fileId: string; orgId: string; jobId?: string }) {
    const file = await this.files.findById(input.fileId, input.orgId);
    const provider = await this.files.getFileProvider(input.fileId);
    const dir = await mkdtemp(join(tmpdir(), 'document-preview-'));
    const sourcePath = join(dir, 'input.pdf');
    const outputBase = join(dir, 'preview');
    try {
      await provider.downloadToFile(file.key, sourcePath);
      try {
        await execFileAsync('pdftoppm', [
          '-jpeg', '-f', '1', '-l', '1', '-singlefile', sourcePath, outputBase,
        ]);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return this.skip(
            input,
            'pdftoppm binary is not available (install poppler-utils on the worker image)',
          );
        }
        throw error;
      }
      const buffer = await readFile(`${outputBase}.jpg`);
      const variantKey = `${file.key.replace(extname(file.key), '')}_thumbnail.jpg`;
      const prior = await this.variants.findByFileIdAndType(input.fileId, 'thumbnail');
      if (prior) {
        await provider.delete(prior.key).catch(() => undefined);
        await this.variants.delete(prior.id);
      }
      await provider.upload(variantKey, buffer, 'image/jpeg');
      await this.variants.create({
        fileId: input.fileId,
        variantType: 'thumbnail',
        variantKey,
        storageProviderId: file.storageProviderId,
        size: BigInt(buffer.length),
        format: 'jpeg',
      });
      const data = { pageCount: null, previewPages: 1, engine: 'pdftoppm' };
      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.DOCUMENT_PREVIEW,
        status: 'completed',
        data,
        jobId: input.jobId ?? null,
        processedAt: new Date(),
      });
      if (input.jobId) {
        await this.jobs.appendLog(input.jobId, 'info', 'Generated PDF first-page preview');
        await this.jobs.setOutput(input.jobId, data);
      }
      return { skipped: false, data };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async skip(
    input: { fileId: string; orgId: string; jobId?: string },
    error: string,
  ) {
    const data = { pageCount: null, previewPages: 0, engine: 'unavailable' };
    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.DOCUMENT_PREVIEW,
      status: 'skipped',
      data,
      error,
      jobId: input.jobId ?? null,
      processedAt: new Date(),
    });
    if (input.jobId) await this.jobs.appendLog(input.jobId, 'warn', error);
    return { skipped: true, data, error };
  }
}
