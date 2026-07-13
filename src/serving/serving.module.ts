import { Module, forwardRef } from '@nestjs/common';
import { ServingController } from './controllers/serving.controller';
import { ServingService } from './services/serving.service';
import { SignedUrlService } from './services/signed-url.service';
import { FilesModule } from '../files/files.module';
import { VariantsModule } from '../variants/variants.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';

@Module({
  imports: [
    forwardRef(() => FilesModule),
    VariantsModule,
    AnalyticsModule,
    StorageProvidersModule,
  ],
  controllers: [ServingController],
  providers: [ServingService, SignedUrlService],
  exports: [ServingService, SignedUrlService],
})
export class ServingModule {}

