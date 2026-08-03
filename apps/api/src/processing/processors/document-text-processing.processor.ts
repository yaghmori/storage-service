import { Processor } from '@nestjs/bullmq';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { DOCUMENT_TEXT_QUEUE } from '../../queues/queue-names';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { DocumentTextProcessingService } from '../services/document-text-processing.service';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { RoadmapJobData, RoadmapProcessingProcessor } from './roadmap-processing.processor';

@Processor(DOCUMENT_TEXT_QUEUE, { concurrency: 2 })
export class DocumentTextProcessingProcessor extends RoadmapProcessingProcessor {
  constructor(
    private readonly service: DocumentTextProcessingService,
    jobs: ProcessingJobsRepository,
    results: FileProcessorResultsRepository,
    rollup: FileProcessingRollupService,
  ) {
    super(jobs, results, rollup);
  }

  process(job: Job<RoadmapJobData>) {
    return this.execute(job, ProcessorKey.DOCUMENT_TEXT, (jobId) =>
      this.service.process({ ...job.data, jobId }),
    );
  }
}
