import { Injectable, Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { FilesService } from '../../files/services/files.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { sanitizeForJsonb } from '../utils/sanitize-jsonb';

@Injectable()
export class MetadataExtractionService {
  private readonly logger = new Logger(MetadataExtractionService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly results: FileProcessorResultsRepository,
  ) {}

  async extractMetadata(fileId: string, orgId: string, jobId?: string) {
    const file = await this.filesService.findById(fileId, orgId);
    const provider = await this.filesService.getFileProvider(fileId);
    const fileBuffer = await provider.download(file.key);

    let allMetadata: Record<string, unknown> = {};

    try {
      const exifr = await import('exifr');
      const parsed = await exifr.parse(fileBuffer, {
        iptc: true,
        xmp: true,
        exif: true,
        gps: true,
        translateKeys: true,
        translateValues: true,
        reviveValues: true,
        sanitize: true,
        mergeOutput: true,
      });

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        allMetadata = sanitizeForJsonb(parsed) as Record<string, unknown>;
      }
    } catch (error) {
      this.logger.warn(
        `EXIF parse skipped for file ${fileId}: ${(error as Error).message}`,
      );
    }

    await this.results.upsert({
      orgId,
      fileId,
      processorKey: ProcessorKey.METADATA_EXIF,
      status: 'completed',
      schemaVersion: 1,
      data: allMetadata,
      jobId: jobId ?? null,
      processedAt: new Date(),
      error: null,
    });

    return allMetadata;
  }
}
