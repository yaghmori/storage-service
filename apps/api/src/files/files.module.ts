import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { VariantsModule } from '../variants/variants.module';
import { FilesController } from './controllers/files.controller';
import { FilesRepository } from './repositories/files.repository';
import { FileDeletionService } from './services/file-deletion.service';
import { FileDuplicationService } from './services/file-duplication.service';
import { FilesChecksumService } from './services/files-checksum.service';
import { FilesService } from './services/files.service';
import { RetentionCleanupService } from './services/retention-cleanup.service';

@Module({
  imports: [
    DatabaseModule,
    StorageProvidersModule,
    VariantsModule,
    OrganizationsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    FilesChecksumService,
    FileDuplicationService,
    FileDeletionService,
    FilesRepository,
    RetentionCleanupService,
  ],
  exports: [FilesService, FilesChecksumService, FileDuplicationService, FileDeletionService],
})
export class FilesModule {}
