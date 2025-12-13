import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ProcessingService } from './services/processing.service';
import { ImageProcessingService } from './services/image-processing.service';
import { VideoProcessingService } from './services/video-processing.service';
import { MetadataExtractionService } from './services/metadata-extraction.service';
import { ImageProcessingProcessor } from './processors/image-processing.processor';
import { VideoProcessingProcessor } from './processors/video-processing.processor';
import { MetadataExtractionProcessor } from './processors/metadata-extraction.processor';
import { ProcessingJobsRepository } from './repositories/processing-jobs.repository';
import { FilesModule } from '../files/files.module';
import { VariantsModule } from '../variants/variants.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { DatabaseModule } from '../database/database.module';
import { QueuesModule } from '../queues/queues.module';
import {
  IMAGE_PROCESSING_QUEUE,
  VIDEO_PROCESSING_QUEUE,
  METADATA_EXTRACTION_QUEUE,
} from '../queues/queue-names';

@Module({
  imports: [
    FilesModule,
    VariantsModule,
    StorageProvidersModule,
    DatabaseModule,
    QueuesModule,
    BullModule.registerQueue(
      { name: IMAGE_PROCESSING_QUEUE },
      { name: VIDEO_PROCESSING_QUEUE },
      { name: METADATA_EXTRACTION_QUEUE },
    ),
  ],
  providers: [
    ProcessingService,
    ImageProcessingService,
    VideoProcessingService,
    MetadataExtractionService,
    ImageProcessingProcessor,
    VideoProcessingProcessor,
    MetadataExtractionProcessor,
    ProcessingJobsRepository,
  ],
  exports: [
    ProcessingService,
    ImageProcessingService,
    VideoProcessingService,
    MetadataExtractionService,
  ],
})
export class ProcessingModule {}

