import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationService } from './organization.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationsModule {}
