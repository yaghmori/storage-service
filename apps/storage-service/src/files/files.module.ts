import { Module } from '@nestjs/common';
import { FilesController } from './controllers/files.controller';
import { FilesMicroserviceController } from './controllers/files-microservice.controller';
import { FilesService } from './services/files.service';
import { FilesChecksumService } from './services/files-checksum.service';
import { FileDuplicationService } from './services/file-duplication.service';
import { FileDeletionService } from './services/file-deletion.service';
import { FilesRepository } from './repositories/files.repository';
import { DatabaseModule } from '../database/database.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';

@Module({
  imports: [DatabaseModule, StorageProvidersModule],
  controllers: [FilesController, FilesMicroserviceController],
  providers: [
    FilesService,
    FilesChecksumService,
    FileDuplicationService,
    FileDeletionService,
    FilesRepository,
  ],
  exports: [FilesService, FilesChecksumService, FileDuplicationService, FileDeletionService],
})
export class FilesModule {}

