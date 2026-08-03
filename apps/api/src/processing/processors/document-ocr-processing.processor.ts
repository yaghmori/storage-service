import { Processor } from '@nestjs/bullmq';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { DOCUMENT_OCR_QUEUE } from '../../queues/queue-names';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { DocumentOcrProcessingService } from '../services/document-ocr-processing.service';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { RoadmapJobData, RoadmapProcessingProcessor } from './roadmap-processing.processor';

@Processor(DOCUMENT_OCR_QUEUE, { concurrency: 1 })
export class DocumentOcrProcessingProcessor extends RoadmapProcessingProcessor {
  constructor(
    private readonly service: DocumentOcrProcessingService,
    jobs: ProcessingJobsRepository,
    results: FileProcessorResultsRepository,
    rollup: FileProcessingRollupService,
  ) {
    super(jobs, results, rollup);
  }

  process(job: Job<RoadmapJobData>) {
    return this.execute(job, ProcessorKey.DOCUMENT_OCR, (jobId) =>
      this.service.process({ ...job.data, jobId }),
    );
  }
}
