import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MetadataExtractionService } from '../services/metadata-extraction.service';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { QueuesService, MetadataExtractionJobData } from '../../queues/queues.service';
import { METADATA_EXTRACTION_QUEUE } from '../../queues/queue-names';

@Processor(METADATA_EXTRACTION_QUEUE)
export class MetadataExtractionProcessor {
  private readonly logger = new Logger(MetadataExtractionProcessor.name);

  constructor(
    private readonly metadataExtractionService: MetadataExtractionService,
    private readonly jobsRepository: ProcessingJobsRepository,
  ) {}

  @Process('extract-metadata')
  async handleMetadataExtraction(job: Job<MetadataExtractionJobData>) {
    this.logger.log(`Extracting metadata for job ${job.id}, file ${job.data.fileId}`);
    
    // Convert fileId to string if it's a number
    const fileId = typeof job.data.fileId === 'number' ? String(job.data.fileId) : job.data.fileId;

    try {
      // Create job record
      const jobRecord = await this.jobsRepository.create({
        fileId,
        jobType: 'metadata',
        status: 'processing',
        bullmqJobId: job.id,
      });

      // Update job status to processing
      await this.jobsRepository.updateStatus(jobRecord.id, 'processing');

      // Extract metadata
      const metadata = await this.metadataExtractionService.extractMetadata(
        fileId,
      );

      // Update job status to completed
      await this.jobsRepository.updateStatus(jobRecord.id, 'completed');

      this.logger.log(`Metadata extraction completed for file ${fileId}`);

      return { success: true, metadata };
    } catch (error) {
      this.logger.error(
        `Metadata extraction failed for file ${fileId}: ${error.message}`,
        error.stack,
      );

      // Update job status to failed
      const jobRecord = await this.jobsRepository.create({
        fileId,
        jobType: 'metadata',
        status: 'failed',
        bullmqJobId: job.id,
      });
      await this.jobsRepository.updateStatus(
        jobRecord.id,
        'failed',
        error.message,
      );

      throw error;
    }
  }
}

