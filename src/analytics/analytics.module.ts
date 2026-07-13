import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DownloadLogsRepository } from './repositories/download-logs.repository';
import { AnalyticsService } from './services/analytics.service';

@Module({
  imports: [DatabaseModule],
  providers: [AnalyticsService, DownloadLogsRepository],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

