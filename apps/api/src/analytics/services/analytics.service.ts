import { Injectable } from '@nestjs/common';
import { DownloadLogsRepository } from '../repositories/download-logs.repository';
import type { GeoLookupResult } from '../utils/geo-lookup';

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: DownloadLogsRepository) {}

  async logDownload(data: {
    fileId: string;
    orgId: string;
    variantId?: string;
    ipAddress?: string;
    userAgent?: string;
    userId?: string;
    bytesDownloaded?: bigint | number;
    downloadMethod?: 'direct' | 'signed_url' | 'cdn';
    referer?: string;
    geo?: GeoLookupResult | null;
  }) {
    return this.repository.create({
      ...data,
      bytesDownloaded:
        data.bytesDownloaded == null
          ? undefined
          : typeof data.bytesDownloaded === 'bigint'
            ? data.bytesDownloaded
            : BigInt(Math.max(0, Math.floor(data.bytesDownloaded))),
      countryCode: data.geo?.countryCode ?? undefined,
      regionCode: data.geo?.regionCode ?? undefined,
      city: data.geo?.city ?? undefined,
      latitude: data.geo?.latitude ?? undefined,
      longitude: data.geo?.longitude ?? undefined,
    });
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
