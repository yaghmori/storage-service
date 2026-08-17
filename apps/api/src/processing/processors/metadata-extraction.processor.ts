import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { DelayedError, Job } from 'bullmq';
import { METADATA_EXTRACTION_QUEUE } from '../../queues/queue-names';
import { processorWorkerOptions } from '../../queues/queue-runtime-settings.service';
import { MetadataExtractionJobData } from '../../queues/queues.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { MetadataExtractionService } from '../services/metadata-extraction.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';

@Processor(
  METADATA_EXTRACTION_QUEUE,
  processorWorkerOptions(METADATA_EXTRACTION_QUEUE),
)
export class MetadataExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(MetadataExtractionProcessor.name);

  constructor(
    private readonly metadataExtractionService: MetadataExtractionService,
    private readonly jobsRepository: ProcessingJobsRepository,
    private readonly rollup: FileProcessingRollupService,
    @Optional() private readonly capacity?: OrgProcessorCapacityService,
  ) {
    super();
  }

  async process(job: Job<MetadataExtractionJobData>) {
    await this.capacity?.assertOrDelay(job, ProcessorKey.METADATA_EXIF);

    const fileId =
      typeof job.data.fileId === 'number'
        ? String(job.data.fileId)
        : job.data.fileId;
    const orgId = job.data.orgId;
    this.logger.log(`Extracting metadata for job ${job.id}, file ${fileId}`);

    let jobRecord = job.id
      ? await this.jobsRepository.findByBullmqJobId(job.id)
      : null;

    if (jobRecord?.status === 'cancelled') {
      this.logger.log(`Skipping cancelled metadata.exif job ${jobRecord.id}`);
      return { success: false, cancelled: true };
    }

    try {
      if (jobRecord && job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'processing');
        await this.jobsRepository.appendLog(
          jobRecord.id,
          'info',
          `Worker picked up metadata.exif (attempt ${job.attemptsMade + 1})`,
        );
      } else if (!jobRecord) {
        jobRecord = await this.jobsRepository.create({
          fileId,
          orgId,
          processorKey: ProcessorKey.METADATA_EXIF,
          status: 'processing',
          bullmqJobId: job.id,
        });
      }

      if (!orgId) {
        throw new Error('orgId is required for metadata extraction');
      }

      const metadata = await this.metadataExtractionService.extractMetadata(
        fileId,
        orgId,
        jobRecord?.id,
      );

      if (jobRecord) {
        await this.jobsRepository.appendLog(
          jobRecord.id,
          'info',
          'Metadata extraction completed',
        );
      }

      if (job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'completed');
      } else if (jobRecord) {
        await this.jobsRepository.updateStatus(jobRecord.id, 'completed');
      }

      await this.rollup.refresh(fileId, orgId);
      return { success: true, metadata };
    } catch (error) {
      if (error instanceof DelayedError) throw error;
      this.logger.error(
        `Metadata extraction failed for file ${fileId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      if (job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(
          job.id,
          'failed',
          (error as Error).message,
        );
      } else if (jobRecord) {
        await this.jobsRepository.updateStatus(
          jobRecord.id,
          'failed',
          (error as Error).message,
        );
      }
      if (jobRecord) {
        await this.jobsRepository.appendLog(
          jobRecord.id,
          'error',
          (error as Error).message,
        );
      }
      if (orgId) await this.rollup.refresh(fileId, orgId);
      throw error;
    }
  }
}
