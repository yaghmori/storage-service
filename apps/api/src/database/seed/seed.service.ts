import { Inject, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { OrgProcessorsService } from '../../processing/services/org-processors.service';
import * as schema from '../drizzle/schema';

type StorageProviderType = 'local' | 'minio' | 's3';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly orgProcessors: OrgProcessorsService,
  ) {}

  async seed(): Promise<void> {
    this.logger.log('Seeding database...');
    const org = await this.ensureDefaultOrg();
    await this.orgProcessors.ensureDefaults(org.id);
    await this.seedAdminUser();
    await this.seedStorageProviders(org.id);
    if (process.env.AUTH_DEFAULT_ORG_ID !== org.id) {
      this.logger.warn(
        `Set AUTH_DEFAULT_ORG_ID=${org.id} for static AUTH_API_KEYS to bind to the default org`,
      );
    }
    this.logger.log('Seeding completed');
  }

  private async ensureDefaultOrg(): Promise<schema.Organization> {
    const [existing] = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, 'default'))
      .limit(1);
    if (existing) {
      this.logger.log(`Default organization exists: ${existing.id}`);
      return existing;
    }
    const [org] = await this.db
      .insert(schema.organizations)
      .values({
        slug: 'default',
        name: 'Default',
        status: 'active',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
      })
      .returning();
    this.logger.log(`Created default organization: ${org.id}`);
    return org;
  }

  private async seedAdminUser(): Promise<void> {
    const email = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin';
    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing) {
      this.logger.log(`Admin user "${email}" already exists`);
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.db.insert(schema.users).values({
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
    });
    this.logger.log(`Created admin user ${email}`);
  }

  private async upsertStorageProvider(
    orgId: string,
    row: {
      name: string;
      type: StorageProviderType;
      config: Record<string, unknown>;
      isActive: boolean;
      isDefault: boolean;
    },
  ): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(schema.storageProviders)
      .where(
        and(
          eq(schema.storageProviders.orgId, orgId),
          eq(schema.storageProviders.name, row.name),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(schema.storageProviders)
        .set({
          orgId,
          type: row.type,
          config: row.config,
          isActive: row.isActive,
          isDefault: row.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(schema.storageProviders.id, existing.id));
      this.logger.log(`Updated storage provider: ${row.name}`);
      return;
    }

    await this.db.insert(schema.storageProviders).values({
      orgId,
      name: row.name,
      type: row.type,
      config: row.config,
      isActive: row.isActive,
      isDefault: row.isDefault,
    });
    this.logger.log(`Created storage provider: ${row.name}`);
  }

  private async seedStorageProviders(orgId: string): Promise<void> {
    const minioReady =
      !!process.env.MINIO_ENDPOINT?.trim() &&
      !!process.env.MINIO_ACCESS_KEY?.trim() &&
      !!process.env.MINIO_SECRET_KEY?.trim() &&
      !!process.env.MINIO_BUCKET?.trim();
    const minioActive = minioReady && process.env.MINIO_ACTIVE !== 'false';

    await this.upsertStorageProvider(orgId, {
      name: 'Local Storage',
      type: 'local',
      config: { path: process.env.UPLOAD_PATH || './uploads' },
      isActive: true,
      isDefault: !minioActive,
    });

    await this.upsertStorageProvider(orgId, {
      name: 'MinIO Storage',
      type: 'minio',
      config: {
        endpoint: process.env.MINIO_ENDPOINT?.trim() || '',
        port: process.env.MINIO_PORT || '9000',
        publicEndpoint:
          process.env.MINIO_PUBLIC_ENDPOINT?.trim() ||
          `http://localhost:${process.env.MINIO_PUBLIC_PORT?.trim() || process.env.MINIO_PORT || '9000'}`,
        accessKeyId: process.env.MINIO_ACCESS_KEY?.trim() || '',
        secretAccessKey: process.env.MINIO_SECRET_KEY?.trim() || '',
        bucket: process.env.MINIO_BUCKET?.trim() || 'storage',
        useSSL: process.env.MINIO_USE_SSL === 'true',
      },
      isActive: minioActive,
      isDefault: minioActive,
    });

    const s3Configured =
      !!process.env.AWS_S3_REGION?.trim() &&
      !!process.env.AWS_S3_ACCESS_KEY_ID?.trim() &&
      !!process.env.AWS_S3_SECRET_ACCESS_KEY?.trim() &&
      !!process.env.AWS_S3_BUCKET?.trim();

    await this.upsertStorageProvider(orgId, {
      name: 'AWS S3 Storage',
      type: 's3',
      config: {
        region: process.env.AWS_S3_REGION?.trim() || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET?.trim() || 'your-bucket-name',
        endpoint: process.env.AWS_S3_ENDPOINT?.trim() || '',
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID?.trim() || 'your-access-key',
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY?.trim() || 'your-secret-key',
      },
      isActive: s3Configured ? process.env.AWS_S3_ACTIVE !== 'false' : false,
      isDefault: false,
    });
  }
}
