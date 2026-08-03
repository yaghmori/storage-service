import { Processor } from '@nestjs/bullmq';
import { Optional } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { DEDUPE_PHASH_QUEUE } from '../../queues/queue-names';
import { processorWorkerOptions } from '../../queues/queue-runtime-settings.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { DedupePhashProcessingService } from '../services/dedupe-phash-processing.service';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { RoadmapJobData, RoadmapProcessingProcessor } from './roadmap-processing.processor';

@Processor(DEDUPE_PHASH_QUEUE, processorWorkerOptions(DEDUPE_PHASH_QUEUE))
export class DedupePhashProcessingProcessor extends RoadmapProcessingProcessor {
  constructor(
    private readonly service: DedupePhashProcessingService,
    jobs: ProcessingJobsRepository,
    results: FileProcessorResultsRepository,
    rollup: FileProcessingRollupService,
    @Optional() capacity?: OrgProcessorCapacityService,
  ) {
    super(jobs, results, rollup, capacity);
  }

  process(job: Job<RoadmapJobData>) {
    return this.execute(job, ProcessorKey.DEDUPE_PHASH, (jobId) =>
      this.service.process({ ...job.data, jobId }),
    );
  }
}
