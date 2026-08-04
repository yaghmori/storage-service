import { Processor } from '@nestjs/bullmq';
import { Optional } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { IMAGE_NORMALIZE_QUEUE } from '../../queues/queue-names';
import { processorWorkerOptions } from '../../queues/queue-runtime-settings.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { ImageNormalizeProcessingService } from '../services/image-normalize-processing.service';
import { RoadmapJobData, RoadmapProcessingProcessor } from './roadmap-processing.processor';

@Processor(IMAGE_NORMALIZE_QUEUE, processorWorkerOptions(IMAGE_NORMALIZE_QUEUE))
export class ImageNormalizeProcessingProcessor extends RoadmapProcessingProcessor {
  constructor(
    private readonly service: ImageNormalizeProcessingService,
    jobs: ProcessingJobsRepository,
    results: FileProcessorResultsRepository,
    rollup: FileProcessingRollupService,
    @Optional() capacity?: OrgProcessorCapacityService,
  ) {
    super(jobs, results, rollup, capacity);
  }

  process(job: Job<RoadmapJobData>) {
    return this.execute(job, ProcessorKey.IMAGE_NORMALIZE, (jobId) =>
      this.service.process({ ...job.data, jobId }),
    );
  }
}
