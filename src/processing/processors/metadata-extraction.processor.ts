import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { METADATA_EXTRACTION_QUEUE } from '../../queues/queue-names';
import { MetadataExtractionJobData } from '../../queues/queues.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { MetadataExtractionService } from '../services/metadata-extraction.service';

@Processor(METADATA_EXTRACTION_QUEUE, { concurrency: 3 })
export class MetadataExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(MetadataExtractionProcessor.name);

  constructor(
    private readonly metadataExtractionService: MetadataExtractionService,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {
    super();
  }

  async process(job: Job<MetadataExtractionJobData>) {
    const jobId = job.id || `temp-${Date.now()}`;
    this.logger.log(`Extracting metadata for job ${jobId}, file ${job.data.fileId}`);

    // Convert fileId to string if it's a number
    const fileId = typeof job.data.fileId === 'number' ? String(job.data.fileId) : job.data.fileId;

    let jobRecord: Awaited<ReturnType<typeof this.jobsRepository.create>> | null = null;

    try {
      // Find existing job record (created when job was added to queue)
      jobRecord = job.id ? await this.jobsRepository.findByBullmqJobId(job.id) : null;

      // If record doesn't exist, create it (backward compatibility)
      if (!jobRecord) {
        jobRecord = await this.jobsRepository.create({
          fileId,
          jobType: 'metadata',
          status: 'processing',
          bullmqJobId: job.id,
        });
      } else if (job.id) {
        // Update existing record to processing
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'processing');
      }

      // Extract metadata
      const metadata = await this.metadataExtractionService.extractMetadata(
        fileId,
      );

      // Update job status to completed
      if (job.id) {
        await this.jobsRepository.updateStatusByBullmqJobId(job.id, 'completed');
      } else if (jobRecord) {
        await this.jobsRepository.updateStatus(jobRecord.id, 'completed');
      }

      this.logger.log(`Metadata extraction completed for file ${fileId}`);

      return { success: true, metadata };
    } catch (error) {
      this.logger.error(
        `Metadata extraction failed for file ${fileId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // Update job status to failed
      if (job.id) {
        let failedJobRecord = await this.jobsRepository.findByBullmqJobId(job.id);
        if (!failedJobRecord) {
          failedJobRecord = await this.jobsRepository.create({
            fileId,
            jobType: 'metadata',
            status: 'failed',
            bullmqJobId: job.id,
          });
        }
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

      throw error;
    }
  }
}
