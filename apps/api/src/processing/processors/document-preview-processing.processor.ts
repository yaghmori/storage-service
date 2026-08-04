import { Processor } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { DOCUMENT_PREVIEW_QUEUE } from '../../queues/queue-names';
import { processorWorkerOptions } from '../../queues/queue-runtime-settings.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { DocumentPreviewProcessingService } from '../services/document-preview-processing.service';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';
import { ProcessorSchedulerService } from '../services/processor-scheduler.service';
import {
  RoadmapJobData,
  RoadmapProcessingProcessor,
} from './roadmap-processing.processor';

@Processor(DOCUMENT_PREVIEW_QUEUE, processorWorkerOptions(DOCUMENT_PREVIEW_QUEUE))
export class DocumentPreviewProcessingProcessor extends RoadmapProcessingProcessor {
  private readonly logger = new Logger(DocumentPreviewProcessingProcessor.name);

  constructor(
    private readonly service: DocumentPreviewProcessingService,
    private readonly scheduler: ProcessorSchedulerService,
    jobs: ProcessingJobsRepository,
    results: FileProcessorResultsRepository,
    rollup: FileProcessingRollupService,
    @Optional() capacity?: OrgProcessorCapacityService,
  ) {
    super(jobs, results, rollup, capacity);
  }

  async process(job: Job<RoadmapJobData>) {
    const result = await this.execute(
      job,
      ProcessorKey.DOCUMENT_PREVIEW,
      (jobId) => this.service.process({ ...job.data, jobId }),
    );
    if (result && !result.skipped) {
      try {
        await this.scheduler.enqueueDocumentOcrAfterPreview({
          fileId: job.data.fileId,
          orgId: job.data.orgId,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to enqueue OCR after preview for ${job.data.fileId}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
    return result;
  }
}
