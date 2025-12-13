import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/schema';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async seedStorageProviders() {
    this.logger.log('Seeding storage providers...');

    // Check if providers already exist
    const existing = await this.db.select().from(schema.storageProviders);
    if (existing.length > 0) {
      this.logger.log('Storage providers already exist, skipping seed');
      return;
    }

    // Seed default local storage provider
    const localProvider = await this.db
      .insert(schema.storageProviders)
      .values({
        name: 'Local Storage',
        type: 'local',
        config: {
          path: process.env.UPLOAD_PATH || './uploads',
        },
        isActive: true,
      })
      .returning();

    this.logger.log(`Created local storage provider with ID: ${localProvider[0].id}`);

    // Seed MinIO provider if configured
    if (
      process.env.MINIO_ENDPOINT &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY &&
      process.env.MINIO_BUCKET
    ) {
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
        })
        .returning();

      this.logger.log(`Created MinIO storage provider with ID: ${minioProvider[0].id}`);
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

