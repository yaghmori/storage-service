import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ProcessingModule } from '../processing/processing.module';
import { QueuesModule } from '../queues/queues.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';

@Module({
  imports: [FilesModule, StorageProvidersModule, QueuesModule, ProcessingModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

