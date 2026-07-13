import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';

@Injectable()
export class DownloadLogsRepository {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: {
    fileId: string;
    variantId?: string;
    ipAddress?: string;
    userAgent?: string;
    userId?: string;
    bytesDownloaded?: bigint;
    downloadMethod?: 'direct' | 'signed_url' | 'cdn';
    referer?: string;
  }) {
    const result = await this.db
      .insert(schema.downloadLogs)
      .values({
        fileId: data.fileId,
        variantId: data.variantId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        userId: data.userId,
        bytesDownloaded: data.bytesDownloaded,
        downloadMethod: data.downloadMethod,
        referer: data.referer,
      })
      .returning();
    return result[0];
  }

  async findByFileId(fileId: string, startDate?: Date, endDate?: Date) {
    const conditions = [eq(schema.downloadLogs.fileId, fileId)];

    if (startDate) {
      conditions.push(gte(schema.downloadLogs.downloadedAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(schema.downloadLogs.downloadedAt, endDate));
    }

    return this.db
      .select()
      .from(schema.downloadLogs)
      .where(and(...conditions));
  }

  async getDownloadStats(fileId: string, startDate?: Date, endDate?: Date) {
    const logs = await this.findByFileId(fileId, startDate, endDate);
    return {
      totalDownloads: logs.length,
      uniqueIPs: new Set(logs.map((log) => log.ipAddress).filter(Boolean)).size,
      downloadsByVariant: logs.reduce((acc, log) => {
        const variantId = log.variantId || 'original';
        acc[variantId] = (acc[variantId] || 0) + 1;
        return acc;
      }, {} as Record<string | number, number>),
    };
  }
}

