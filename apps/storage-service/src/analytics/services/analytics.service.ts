import { Injectable } from '@nestjs/common';
import { DownloadLogsRepository } from '../repositories/download-logs.repository';

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: DownloadLogsRepository) {}

  async logDownload(data: {
    fileId: string;
    variantId?: string;
    ipAddress?: string;
    userAgent?: string;
    userId?: number;
    bytesDownloaded?: bigint;
    downloadMethod?: string;
    referer?: string;
  }) {
    return this.repository.create(data);
  }

  async getDownloadStats(
    fileId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.repository.getDownloadStats(fileId, startDate, endDate);
  }

  async getDownloadHistory(
    fileId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.repository.findByFileId(fileId, startDate, endDate);
  }
}

