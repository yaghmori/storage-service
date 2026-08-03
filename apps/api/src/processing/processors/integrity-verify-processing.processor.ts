import { Processor } from '@nestjs/bullmq';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { INTEGRITY_VERIFY_QUEUE } from '../../queues/queue-names';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { IntegrityVerifyProcessingService } from '../services/integrity-verify-processing.service';
import { RoadmapJobData, RoadmapProcessingProcessor } from './roadmap-processing.processor';

@Processor(INTEGRITY_VERIFY_QUEUE, { concurrency: 2 })
export class IntegrityVerifyProcessingProcessor extends RoadmapProcessingProcessor {
  constructor(
    private readonly service: IntegrityVerifyProcessingService,
    jobs: ProcessingJobsRepository,
    results: FileProcessorResultsRepository,
    rollup: FileProcessingRollupService,
  ) {
    super(jobs, results, rollup);
  }

  process(job: Job<RoadmapJobData>) {
    return this.execute(job, ProcessorKey.INTEGRITY_VERIFY, (jobId) =>
      this.service.process({ ...job.data, jobId }),
    );
  }
}
