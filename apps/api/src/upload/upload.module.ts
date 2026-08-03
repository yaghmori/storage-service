import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProcessingModule } from '../processing/processing.module';
import { QueuesModule } from '../queues/queues.module';
import { ServingModule } from '../serving/serving.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { LegacyStorageMicroserviceController } from './controllers/legacy-storage-microservice.controller';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';

@Module({
  imports: [
    FilesModule,
    StorageProvidersModule,
    QueuesModule,
    ProcessingModule,
    ServingModule,
    OrganizationsModule,
  ],
  controllers: [UploadController, LegacyStorageMicroserviceController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

