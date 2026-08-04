import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestContextMiddleware } from './lib/contracts';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CommonModule } from './common/common.module';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProcessingModule } from './processing/processing.module';
import { QueuesModule } from './queues/queues.module';
import { ServingModule } from './serving/serving.module';
import { StorageProvidersModule } from './storage-providers/storage-providers.module';
import { UploadModule } from './upload/upload.module';
import { VariantsModule } from './variants/variants.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    AppConfigModule,
    DatabaseModule,
    OrganizationsModule,
    QueuesModule,
    HealthModule,
    EventsModule,
    StorageProvidersModule,
    FilesModule,
    UploadModule,
    ProcessingModule.forRoot(),
    VariantsModule,
    ServingModule,
    AnalyticsModule,
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
