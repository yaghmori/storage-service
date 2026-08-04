import { Processor } from '@nestjs/bullmq';
import { Optional } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { INTEGRITY_VERIFY_QUEUE } from '../../queues/queue-names';
import { processorWorkerOptions } from '../../queues/queue-runtime-settings.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { IntegrityVerifyProcessingService } from '../services/integrity-verify-processing.service';
import { RoadmapJobData, RoadmapProcessingProcessor } from './roadmap-processing.processor';

@Processor(INTEGRITY_VERIFY_QUEUE, processorWorkerOptions(INTEGRITY_VERIFY_QUEUE))
export class IntegrityVerifyProcessingProcessor extends RoadmapProcessingProcessor {
  constructor(
    private readonly service: IntegrityVerifyProcessingService,
    jobs: ProcessingJobsRepository,
    results: FileProcessorResultsRepository,
    rollup: FileProcessingRollupService,
    @Optional() capacity?: OrgProcessorCapacityService,
  ) {
    super(jobs, results, rollup, capacity);
  }

  process(job: Job<RoadmapJobData>) {
    return this.execute(job, ProcessorKey.INTEGRITY_VERIFY, (jobId) =>
      this.service.process({ ...job.data, jobId }),
    );
  }
}
