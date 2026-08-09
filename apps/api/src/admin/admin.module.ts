import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { FilesModule } from '../files/files.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProcessingModule } from '../processing/processing.module';
import { QueuesModule } from '../queues/queues.module';
import { ServingModule } from '../serving/serving.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { UploadModule } from '../upload/upload.module';
import { VariantsModule } from '../variants/variants.module';
import { AdminAuthModule } from './admin-auth.module';
import { AdminInvitesController } from './controllers/admin-invites.controller';
import {
  AdminMembersByHeaderController,
  AdminMembersController,
} from './controllers/admin-members.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { ApiKeysController } from './controllers/api-keys.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { FilesController } from './controllers/files.controller';
import { JobsController } from './controllers/jobs.controller';
import { OrganizationsController } from './controllers/organizations.controller';
import { ProcessorBackendsController } from './controllers/processor-backends.controller';
import { ProvidersController } from './controllers/providers.controller';
import { OrgMembershipGuard } from './guards/org-membership.guard';
import { AdminApiKeyService } from './services/admin-api-key.service';
import { MembershipService } from './services/membership.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    CommonModule,
    OrganizationsModule,
    ProcessingModule,
    VariantsModule,
    AdminAuthModule,
    UploadModule,
    ServingModule,
    FilesModule,
    QueuesModule,
    StorageProvidersModule,
  ],
  controllers: [
    DashboardController,
    FilesController,
    ProvidersController,
    JobsController,
    AnalyticsController,
    ApiKeysController,
    OrganizationsController,
    ProcessorBackendsController,
    AdminUsersController,
    AdminMembersController,
    AdminMembersByHeaderController,
    AdminInvitesController,
  ],
  providers: [AdminApiKeyService, MembershipService, OrgMembershipGuard],
  exports: [MembershipService],
})
export class AdminModule {}
