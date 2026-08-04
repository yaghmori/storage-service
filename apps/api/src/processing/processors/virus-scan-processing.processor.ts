import { Processor } from '@nestjs/bullmq';
import { Optional } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { Job } from 'bullmq';
import { VIRUS_SCAN_QUEUE } from '../../queues/queue-names';
import { processorWorkerOptions } from '../../queues/queue-runtime-settings.service';
import { OrgProcessorCapacityService } from '../services/org-processor-capacity.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { FileProcessingRollupService } from '../services/file-processing-rollup.service';
import { VirusScanProcessingService } from '../services/virus-scan-processing.service';
import { RoadmapJobData, RoadmapProcessingProcessor } from './roadmap-processing.processor';

@Processor(VIRUS_SCAN_QUEUE, processorWorkerOptions(VIRUS_SCAN_QUEUE))
export class VirusScanProcessingProcessor extends RoadmapProcessingProcessor {
  constructor(
    private readonly service: VirusScanProcessingService,
    jobs: ProcessingJobsRepository,
    results: FileProcessorResultsRepository,
    rollup: FileProcessingRollupService,
    @Optional() capacity?: OrgProcessorCapacityService,
  ) {
    super(jobs, results, rollup, capacity);
  }

  process(job: Job<RoadmapJobData>) {
    return this.execute(job, ProcessorKey.SECURITY_VIRUS_SCAN, (jobId) =>
      this.service.process({
        ...job.data,
        jobId,
        backendId: (job.data as { backendId?: string | null }).backendId,
      }),
    );
  }
}
