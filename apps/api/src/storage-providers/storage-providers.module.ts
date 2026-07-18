import { Module } from '@nestjs/common';
import { StorageProvidersService } from './services/storage-providers.service';
import { StorageFactoryService } from './services/storage-factory.service';
import { S3StorageService } from './services/s3-storage.service';
import { MinIOStorageService } from './services/minio-storage.service';
import { LocalStorageService } from './services/local-storage.service';
import { StorageProvidersRepository } from './repositories/storage-providers.repository';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    StorageProvidersService,
    StorageFactoryService,
    S3StorageService,
    MinIOStorageService,
    LocalStorageService,
    StorageProvidersRepository,
  ],
  exports: [StorageProvidersService, StorageFactoryService],
})
export class StorageProvidersModule {}

