import { Module } from '@nestjs/common';
import { appRole } from '../config/app-role';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { VariantsModule } from '../variants/variants.module';
import { FilesController } from './controllers/files.controller';
import { FilesMicroserviceInsightsController } from './controllers/files-microservice-insights.controller';
import { FilesRepository } from './repositories/files.repository';
import { FileDeletionService } from './services/file-deletion.service';
import { FileDuplicationService } from './services/file-duplication.service';
import { FileInsightsService } from './services/file-insights.service';
import { FilesChecksumService } from './services/files-checksum.service';
import { FilesService } from './services/files.service';
import { RetentionCleanupService } from './services/retention-cleanup.service';

@Module({
  imports: [
    DatabaseModule,
    StorageProvidersModule,
    VariantsModule,
    OrganizationsModule,
    EventsModule,
  ],
  controllers: [FilesController, FilesMicroserviceInsightsController],
  providers: [
    FilesService,
    FileInsightsService,
    FilesChecksumService,
    FileDuplicationService,
    FileDeletionService,
    FilesRepository,
    ...(appRole.enableCrons ? [RetentionCleanupService] : []),
  ],
  exports: [
    FilesService,
    FileInsightsService,
    FilesChecksumService,
    FileDuplicationService,
    FileDeletionService,
    FilesRepository,
  ],
})
export class FilesModule {}
