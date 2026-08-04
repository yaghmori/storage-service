import {
  Module,
  DynamicModule,
  forwardRef,
  Provider,
  Type,
  Global,
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { appRole } from '../config/app-role';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { FilesModule } from '../files/files.module';
import { QueuesModule } from '../queues/queues.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { VariantsModule } from '../variants/variants.module';
import { AiVisionProcessingProcessor } from './processors/ai-vision-processing.processor';
import { DedupePhashProcessingProcessor } from './processors/dedupe-phash-processing.processor';
import { DocumentOcrProcessingProcessor } from './processors/document-ocr-processing.processor';
import { DocumentPreviewProcessingProcessor } from './processors/document-preview-processing.processor';
import { DocumentTextProcessingProcessor } from './processors/document-text-processing.processor';
import { ImageNormalizeProcessingProcessor } from './processors/image-normalize-processing.processor';
import { ImageProcessingProcessor } from './processors/image-processing.processor';
import { IntegrityVerifyProcessingProcessor } from './processors/integrity-verify-processing.processor';
import { MetadataExtractionProcessor } from './processors/metadata-extraction.processor';
import { NotifyWebhookProcessingProcessor } from './processors/notify-webhook-processing.processor';
import { VideoProcessingProcessor } from './processors/video-processing.processor';
import { FileProcessorResultsRepository } from './repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from './repositories/processing-jobs.repository';
import { AiVisionProcessingService } from './services/ai-vision-processing.service';
import { DedupePhashProcessingService } from './services/dedupe-phash-processing.service';
import { DocumentOcrProcessingService } from './services/document-ocr-processing.service';
import { DocumentPreviewProcessingService } from './services/document-preview-processing.service';
import { DocumentTextProcessingService } from './services/document-text-processing.service';
import { FileProcessingRollupService } from './services/file-processing-rollup.service';
import { ImageNormalizeProcessingService } from './services/image-normalize-processing.service';
import { ImageProcessingService } from './services/image-processing.service';
import { IntegrityVerifyProcessingService } from './services/integrity-verify-processing.service';
import { IntegrityVerifySweepService } from './services/integrity-verify-sweep.service';
import { MetadataExtractionService } from './services/metadata-extraction.service';
import { NotifyWebhookProcessingService } from './services/notify-webhook-processing.service';
import { OpenaiCompatibleClient } from './services/openai-compatible.client';
import { OrgProcessorCapacityService } from './services/org-processor-capacity.service';
import { OrgProcessorsService } from './services/org-processors.service';
import { ProcessingService } from './services/processing.service';
import { ProcessingSettingsService } from './services/processing-settings.service';
import { ProcessorBackendsService } from './services/processor-backends.service';
import { ProcessorSchedulerService } from './services/processor-scheduler.service';
import { VideoProcessingService } from './services/video-processing.service';

const CORE_PROVIDERS: Provider[] = [
  ProcessingService,
  ProcessingSettingsService,
  OrgProcessorsService,
  OrgProcessorCapacityService,
  ProcessorBackendsService,
  ProcessorSchedulerService,
  FileProcessingRollupService,
  OpenaiCompatibleClient,
  ImageNormalizeProcessingService,
  ImageProcessingService,
  VideoProcessingService,
  MetadataExtractionService,
  AiVisionProcessingService,
  DedupePhashProcessingService,
  IntegrityVerifyProcessingService,
  DocumentPreviewProcessingService,
  DocumentTextProcessingService,
  DocumentOcrProcessingService,
  NotifyWebhookProcessingService,
  ProcessingJobsRepository,
  FileProcessorResultsRepository,
];

const WORKER_PROVIDERS: Type[] = [
  ImageNormalizeProcessingProcessor,
  ImageProcessingProcessor,
  VideoProcessingProcessor,
  MetadataExtractionProcessor,
  AiVisionProcessingProcessor,
  DedupePhashProcessingProcessor,
  IntegrityVerifyProcessingProcessor,
  DocumentPreviewProcessingProcessor,
  DocumentTextProcessingProcessor,
  DocumentOcrProcessingProcessor,
  NotifyWebhookProcessingProcessor,
];

const CORE_EXPORTS = [
  ProcessingService,
  ProcessingSettingsService,
  OrgProcessorsService,
  ProcessorBackendsService,
  ProcessorSchedulerService,
  FileProcessingRollupService,
  ImageProcessingService,
  VideoProcessingService,
  MetadataExtractionService,
  AiVisionProcessingService,
  ProcessingJobsRepository,
  FileProcessorResultsRepository,
];

/**
 * Core processing (scheduler, settings, services) is always registered.
 * BullMQ processors / crons are added only when ENABLE_WORKERS / ENABLE_CRONS.
 */
@Global()
@Module({
  imports: [
    FilesModule,
    VariantsModule,
    StorageProvidersModule,
    DatabaseModule,
    EventsModule,
    forwardRef(() => QueuesModule),
  ],
  providers: CORE_PROVIDERS,
  exports: CORE_EXPORTS,
})
export class ProcessingModule {
  static forRoot(): DynamicModule {
    const enableWorkers = appRole.enableWorkers;
    const enableCrons = appRole.enableCrons;

    const providers: Provider[] = [];
    if (enableWorkers) {
      providers.push(...WORKER_PROVIDERS);
    }
    if (enableCrons) {
      providers.push(IntegrityVerifySweepService);
    }

    return {
      module: ProcessingModule,
      imports: enableCrons ? [ScheduleModule.forRoot()] : [],
      providers,
      exports: CORE_EXPORTS,
    };
  }
}
