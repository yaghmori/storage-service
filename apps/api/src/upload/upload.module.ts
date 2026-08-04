import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { FilesModule } from '../files/files.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProcessingModule } from '../processing/processing.module';
import { QueuesModule } from '../queues/queues.module';
import { ServingModule } from '../serving/serving.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { LegacyStorageMicroserviceController } from './controllers/legacy-storage-microservice.controller';
import { UploadController } from './controllers/upload.controller';
import { DirectUploadService } from './services/direct-upload.service';
import { UploadService } from './services/upload.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    FilesModule,
    StorageProvidersModule,
    QueuesModule,
    ProcessingModule,
    ServingModule,
    OrganizationsModule,
    EventsModule,
  ],
  controllers: [UploadController, LegacyStorageMicroserviceController],
  providers: [UploadService, DirectUploadService],
  exports: [UploadService, DirectUploadService],
})
export class UploadModule {}
