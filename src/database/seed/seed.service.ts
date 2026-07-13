import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../drizzle/schema';

type StorageProviderType = 'local' | 'minio' | 's3';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private async upsertStorageProvider(row: {
    name: string;
    type: StorageProviderType;
    config: Record<string, unknown>;
    isActive: boolean;
    isDefault: boolean;
  }): Promise<void> {
    await this.db
      .insert(schema.storageProviders)
      .values({
        name: row.name,
        type: row.type,
        config: row.config,
        isActive: row.isActive,
        isDefault: row.isDefault,
      })
      .onConflictDoUpdate({
        target: schema.storageProviders.name,
        set: {
          type: row.type,
          config: row.config,
          isActive: row.isActive,
          isDefault: row.isDefault,
          updatedAt: new Date(),
        },
      });
    this.logger.log(`Upserted storage provider: ${row.name} (${row.type}, default=${row.isDefault})`);
  }

  /**
   * Production / CI: three rows (Local, MinIO, S3) aligned with dev export; upsert by name.
   * MinIO/S3 config from env (endpoint/bucket/keys), not localhost — set MINIO_ENDPOINT e.g. minio or api host.
   */
  async seedStorageProvidersProduction(): Promise<void> {
    this.logger.log('Seeding storage providers (production upsert)...');

    const minioReady =
      !!process.env.MINIO_ENDPOINT?.trim() &&
      !!process.env.MINIO_ACCESS_KEY?.trim() &&
      !!process.env.MINIO_SECRET_KEY?.trim() &&
      !!process.env.MINIO_BUCKET?.trim();
    const minioActive = minioReady && process.env.MINIO_ACTIVE !== 'false';

    const localPath = process.env.UPLOAD_PATH || './uploads';
    await this.upsertStorageProvider({
      name: 'Local Storage',
      type: 'local',
      config: { path: localPath },
      isActive: true,
      isDefault: !minioActive,
    });

    const minioConfig = {
      endpoint: process.env.MINIO_ENDPOINT?.trim() || '',
      port: process.env.MINIO_PORT || '9000',
      accessKeyId: process.env.MINIO_ACCESS_KEY?.trim() || '',
      secretAccessKey: process.env.MINIO_SECRET_KEY?.trim() || '',
      bucket: process.env.MINIO_BUCKET?.trim() || 'storage',
      useSSL: process.env.MINIO_USE_SSL === 'true',
    };
    await this.upsertStorageProvider({
      name: 'MinIO Storage',
      type: 'minio',
      config: minioConfig,
      isActive: minioActive,
      isDefault: minioActive,
    });

    const s3Configured =
      !!process.env.AWS_S3_REGION?.trim() &&
      !!process.env.AWS_S3_ACCESS_KEY_ID?.trim() &&
      !!process.env.AWS_S3_SECRET_ACCESS_KEY?.trim() &&
      !!process.env.AWS_S3_BUCKET?.trim();
    const s3Config = {
      region: process.env.AWS_S3_REGION?.trim() || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET?.trim() || 'your-bucket-name',
      endpoint: process.env.AWS_S3_ENDPOINT?.trim() || '',
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID?.trim() || 'your-access-key',
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY?.trim() || 'your-secret-key',
    };
    /** Dev export had S3 active with placeholders; when fully configured, respect AWS_S3_ACTIVE. */
    const s3Active = s3Configured
      ? process.env.AWS_S3_ACTIVE !== 'false' && process.env.AWS_S3_ACTIVE !== '0'
      : true;
    await this.upsertStorageProvider({
      name: 'AWS S3 Storage',
      type: 's3',
      config: s3Config,
      isActive: s3Active,
      isDefault: false,
    });

    this.logger.log('Storage providers production seed completed');
  }

  async seedStorageProviders() {
    this.logger.log('Seeding storage providers...');

    if (process.env.PRODUCTION_SEED === '1') {
      await this.seedStorageProvidersProduction();
      return;
    }

    // Check if providers already exist
    const existing = await this.db.select().from(schema.storageProviders);
    if (existing.length > 0) {
      this.logger.log('Storage providers already exist, skipping seed');
      return;
    }

    // Check if MinIO is configured to determine default provider
    const isMinIOConfigured =
      process.env.MINIO_ENDPOINT &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY &&
      process.env.MINIO_BUCKET;

    // Seed local storage provider (fallback if MinIO not configured)
    const localProvider = await this.db
      .insert(schema.storageProviders)
      .values({
        name: 'Local Storage',
        type: 'local',
        config: {
          path: process.env.UPLOAD_PATH || './uploads',
        },
        isActive: true,
        isDefault: !isMinIOConfigured, // Only default if MinIO is not configured
      })
      .returning();

    this.logger.log(
      `Created local storage provider with ID: ${localProvider[0].id}${!isMinIOConfigured ? ' (marked as default)' : ''}`,
    );

    // Seed MinIO provider if configured (set as default)
    if (isMinIOConfigured) {
      const minioProvider = await this.db
        .insert(schema.storageProviders)
        .values({
          name: 'MinIO Storage',
          type: 'minio',
          config: {
            endpoint: process.env.MINIO_ENDPOINT,
            port: process.env.MINIO_PORT || '9000',
            accessKeyId: process.env.MINIO_ACCESS_KEY,
            secretAccessKey: process.env.MINIO_SECRET_KEY,
            bucket: process.env.MINIO_BUCKET,
            useSSL: process.env.MINIO_USE_SSL === 'true',
          },
          isActive: process.env.MINIO_ACTIVE !== 'false',
          isDefault: true, // Mark MinIO as default provider
        })
        .returning();

      this.logger.log(`Created MinIO storage provider with ID: ${minioProvider[0].id} (marked as default)`);
    }

    // Seed AWS S3 provider if configured
    if (
      process.env.AWS_S3_REGION &&
      process.env.AWS_S3_ACCESS_KEY_ID &&
      process.env.AWS_S3_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET
    ) {
      const s3Provider = await this.db
        .insert(schema.storageProviders)
        .values({
          name: 'AWS S3 Storage',
          type: 's3',
          config: {
            region: process.env.AWS_S3_REGION,
            accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
            bucket: process.env.AWS_S3_BUCKET,
            endpoint: process.env.AWS_S3_ENDPOINT,
          },
          isActive: process.env.AWS_S3_ACTIVE !== 'false',
        })
        .returning();

      this.logger.log(`Created AWS S3 storage provider with ID: ${s3Provider[0].id}`);
    }

    this.logger.log('Storage providers seeding completed');
  }

  async seed() {
    try {
      await this.seedStorageProviders();
      this.logger.log('Database seeding completed successfully');
    } catch (error) {
      this.logger.error('Database seeding failed', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}

