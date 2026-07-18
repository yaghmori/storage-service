import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FilesModule } from '../files/files.module';
import { QueuesModule } from '../queues/queues.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { VariantsModule } from '../variants/variants.module';
import { ImageProcessingProcessor } from './processors/image-processing.processor';
import { MetadataExtractionProcessor } from './processors/metadata-extraction.processor';
import { VideoProcessingProcessor } from './processors/video-processing.processor';
import { ProcessingJobsRepository } from './repositories/processing-jobs.repository';
import { ImageProcessingService } from './services/image-processing.service';
import { MetadataExtractionService } from './services/metadata-extraction.service';
import { ProcessingService } from './services/processing.service';
import { VideoProcessingService } from './services/video-processing.service';

@Module({
  imports: [
    FilesModule,
    VariantsModule,
    StorageProvidersModule,
    DatabaseModule,
    forwardRef(() => QueuesModule),
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
    ProcessingJobsRepository,
  ],
})
export class ProcessingModule {}

