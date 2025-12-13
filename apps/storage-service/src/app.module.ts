import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { QueuesModule } from './queues/queues.module';
import { StorageProvidersModule } from './storage-providers/storage-providers.module';
import { FilesModule } from './files/files.module';
import { UploadModule } from './upload/upload.module';
import { ProcessingModule } from './processing/processing.module';
import { VariantsModule } from './variants/variants.module';
import { ServingModule } from './serving/serving.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    // Global modules
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    AppConfigModule,
    
    // Infrastructure modules
    DatabaseModule,
    QueuesModule,
    
    // Feature modules
    StorageProvidersModule,
    FilesModule,
    UploadModule,
    ProcessingModule,
    VariantsModule,
    ServingModule,
    AnalyticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

