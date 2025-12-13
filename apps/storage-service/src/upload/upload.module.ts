import { Module } from '@nestjs/common';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';
import { FilesModule } from '../files/files.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [FilesModule, StorageProvidersModule, QueuesModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

