import { Injectable } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { DatabaseConfig } from '../config/database.config';
import { RedisConfig } from '../config/redis.config';
import { StorageConfig } from '../config/storage.config';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly redisConfig: RedisConfig,
    private readonly databaseService: DatabaseService,
    private readonly databaseConfig: DatabaseConfig,
    private readonly storageConfig: StorageConfig,
  ) {}

  async checkRedis(): Promise<{
    status: string;
    latency?: number;
    host?: string;
    port?: number;
    error?: string;
  }> {
    const redis = new Redis({
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      password: this.redisConfig.password,
      db: this.redisConfig.db,
      connectTimeout: 3000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      const startTime = Date.now();
      await redis.connect();
      await redis.ping();
      const latency = Date.now() - startTime;
      await redis.quit();

      return {
        status: 'ok',
        latency,
        host: this.redisConfig.host,
        port: this.redisConfig.port,
      };
    } catch (error) {
      await redis.quit().catch(() => {
        // Ignore quit errors
      });
      return {
        status: 'error',
        host: this.redisConfig.host,
        port: this.redisConfig.port,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkDatabase(): Promise<{
    status: string;
    latency?: number;
    host?: string;
    port?: number;
    database?: string;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      // Simple query to check database connectivity
      await this.databaseService.getDb().execute(sql`SELECT 1`);
      const latency = Date.now() - startTime;

      return {
        status: 'ok',
        latency,
        host: this.databaseConfig.host,
        port: this.databaseConfig.port,
        database: this.databaseConfig.database,
      };
    } catch (error) {
      return {
        status: 'error',
        host: this.databaseConfig.host,
        port: this.databaseConfig.port,
        database: this.databaseConfig.database,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkMinio(): Promise<{
    status: string;
    latency?: number;
    host?: string;
    port?: number;
    error?: string;
  }> {
    if (this.storageConfig.defaultProvider !== 'minio') {
      return { status: 'skipped' };
    }

    const host = process.env.MINIO_ENDPOINT?.trim() || 'minio';
    const port = parseInt(process.env.MINIO_PORT || '9000', 10);
    const useSSL = ['1', 'true', 'yes', 'on'].includes(
      (process.env.MINIO_USE_SSL || '').trim().toLowerCase(),
    );
    const client = useSSL ? https : http;

    const startTime = Date.now();
    return new Promise((resolve) => {
      const req = client.get(
        {
          hostname: host,
          port: Number.isFinite(port) ? port : 9000,
          path: '/minio/health/live',
          timeout: 3000,
        },
        (res) => {
          res.resume();
          const latency = Date.now() - startTime;
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: 'ok', latency, host, port });
            return;
          }
          resolve({
            status: 'error',
            latency,
            host,
            port,
            error: `HTTP ${res.statusCode ?? 'unknown'}`,
          });
        },
      );
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'error', host, port, error: 'timeout' });
      });
      req.on('error', (error) => {
        resolve({
          status: 'error',
          host,
          port,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    });
  }

  getSystemInfo(): {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    platform: string;
    nodeVersion: string;
    timestamp: string;
  } {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    return {
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(usedMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage * 100) / 100,
      },
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };
  }

  getApplicationInfo(): {
    name: string;
    version: string;
    environment: string;
  } {
    return {
      name: 'storage-service',
      version: '0.0.1',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  async getOverallHealth(): Promise<{
    status: string;
    database: Awaited<ReturnType<HealthService['checkDatabase']>>;
    redis: Awaited<ReturnType<HealthService['checkRedis']>>;
    minio: Awaited<ReturnType<HealthService['checkMinio']>>;
    system: ReturnType<HealthService['getSystemInfo']>;
    application: ReturnType<HealthService['getApplicationInfo']>;
  }> {
    const [database, redis, minio] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMinio(),
    ]);

    const allHealthy =
      database.status === 'ok' &&
      redis.status === 'ok' &&
      (minio.status === 'ok' || minio.status === 'skipped');
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    return {
      status: overallStatus,
      database,
      redis,
      minio,
      system: this.getSystemInfo(),
      application: this.getApplicationInfo(),
    };
  }
}
