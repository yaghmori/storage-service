import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminJwtService } from './services/admin-jwt.service';
import { AdminUserService } from './services/admin-user.service';

/**
 * Lean auth surface shared by admin controllers (templates/providers/etc)
 * without pulling Queues/Email/Templates into a cycle.
 */
@Global()
@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [AdminAuthController],
  providers: [AdminUserService, AdminJwtService, AdminAuthGuard],
  exports: [AdminAuthGuard, AdminUserService, AdminJwtService],
})
export class AdminAuthModule {}
