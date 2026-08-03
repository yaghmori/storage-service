import { Processor } from '@nestjs/bullmq';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { IMAGE_NORMALIZE_QUEUE } from '../../queues/queue-names';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { ImageNormalizeProcessingService } from '../services/image-normalize-processing.service';
import { RoadmapJobData, RoadmapProcessingProcessor } from './roadmap-processing.processor';

@Processor(IMAGE_NORMALIZE_QUEUE, { concurrency: 2 })
export class ImageNormalizeProcessingProcessor extends RoadmapProcessingProcessor {
  constructor(
    private readonly service: ImageNormalizeProcessingService,
    jobs: ProcessingJobsRepository,
    results: FileProcessorResultsRepository,
    rollup: FileProcessingRollupService,
  ) {
    super(jobs, results, rollup);
  }

  process(job: Job<RoadmapJobData>) {
    return this.execute(job, ProcessorKey.IMAGE_NORMALIZE, (jobId) =>
      this.service.process({ ...job.data, jobId }),
    );
  }
}
