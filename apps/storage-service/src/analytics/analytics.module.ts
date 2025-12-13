import { Module } from '@nestjs/common';
import { AnalyticsService } from './services/analytics.service';
import { DownloadLogsRepository } from './repositories/download-logs.repository';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AnalyticsService, DownloadLogsRepository],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

