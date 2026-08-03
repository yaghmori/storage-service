import { Module } from '@nestjs/common';
import { ServingController } from './controllers/serving.controller';
import { ServingService } from './services/serving.service';
import { SignedUrlService } from './services/signed-url.service';
import { FilesMicroserviceController } from '../files/controllers/files-microservice.controller';
import { FilesModule } from '../files/files.module';
import { VariantsModule } from '../variants/variants.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { DatabaseModule } from '../database/database.module';

/**
 * Serving sits above Files + Variants (no reverse imports into those modules)
 * to avoid Nest circular DI / undefined tokens at bootstrap.
 */
@Module({
  imports: [
    DatabaseModule,
    FilesModule,
    VariantsModule,
    AnalyticsModule,
    StorageProvidersModule,
  ],
  controllers: [ServingController, FilesMicroserviceController],
  providers: [ServingService, SignedUrlService],
  exports: [ServingService, SignedUrlService],
})
export class ServingModule {}
