import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ServingModule } from '../serving/serving.module';
import { UploadModule } from '../upload/upload.module';
import { AdminAuthModule } from './admin-auth.module';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { ApiKeysController } from './controllers/api-keys.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { FilesController } from './controllers/files.controller';
import { JobsController } from './controllers/jobs.controller';
import { OrganizationsController } from './controllers/organizations.controller';
import { ProvidersController } from './controllers/providers.controller';
import { AdminApiKeyService } from './services/admin-api-key.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    CommonModule,
    OrganizationsModule,
    AdminAuthModule,
    UploadModule,
    ServingModule,
  ],
  controllers: [
    DashboardController,
    FilesController,
    ProvidersController,
    JobsController,
    AnalyticsController,
    ApiKeysController,
    OrganizationsController,
    AdminUsersController,
  ],
  providers: [AdminApiKeyService],
})
export class AdminModule {}
