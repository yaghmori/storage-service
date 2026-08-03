import { Injectable, Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesChecksumService } from '../../files/services/files-checksum.service';
import { FilesService } from '../../files/services/files.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';

@Injectable()
export class IntegrityVerifyProcessingService {
  private readonly logger = new Logger(IntegrityVerifyProcessingService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly checksums: FilesChecksumService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
  ) {}

  async process(input: { fileId: string; orgId: string; jobId?: string }) {
    const file = await this.filesService.findById(input.fileId, input.orgId);
    const expectedHash = file.sha256Hash;
    if (!expectedHash) {
      throw new Error('File has no stored SHA-256 hash');
    }

    await this.log(input.jobId, 'info', 'Re-hashing stored object');
    const provider = await this.filesService.getFileProvider(input.fileId);
    const tempPath = join(tmpdir(), `verify_${input.fileId}_${Date.now()}`);
    try {
      await provider.downloadToFile(file.key, tempPath);
      const actual = await this.checksums.calculateSHA256Stream(
        createReadStream(tempPath),
      );
      const matched = actual.toLowerCase() === expectedHash.toLowerCase();
      const data = {
        expected: expectedHash,
        actual,
        matched,
        size: Number(file.size),
        verifiedAt: new Date().toISOString(),
      };

      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.INTEGRITY_VERIFY,
        status: matched ? 'completed' : 'failed',
        data,
        error: matched ? null : 'SHA-256 checksum mismatch',
        jobId: input.jobId ?? null,
        processedAt: new Date(),
      });
      if (input.jobId) await this.jobs.setOutput(input.jobId, data);
      if (!matched) {
        await this.log(input.jobId, 'error', 'SHA-256 checksum mismatch');
        throw new Error(
          `Integrity check failed: expected ${expectedHash}, got ${actual}`,
        );
      }
      await this.log(input.jobId, 'info', 'Checksum matched');
      return data;
    } finally {
      await unlink(tempPath).catch(() => undefined);
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
