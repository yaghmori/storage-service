import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { DatabaseConfig } from '../config/database.config';
import { RedisConfig } from '../config/redis.config';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly redisConfig: RedisConfig,
    private readonly databaseService: DatabaseService,
    private readonly databaseConfig: DatabaseConfig,
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
    system: ReturnType<HealthService['getSystemInfo']>;
    application: ReturnType<HealthService['getApplicationInfo']>;
  }> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    // Determine overall status
    const allHealthy = database.status === 'ok' && redis.status === 'ok';
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    return {
      status: overallStatus,
      database,
      redis,
      system: this.getSystemInfo(),
      application: this.getApplicationInfo(),
    };
  }
}
