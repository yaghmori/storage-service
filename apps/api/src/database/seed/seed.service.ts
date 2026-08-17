import { Inject, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { OrgProcessorsService } from '../../processing/services/org-processors.service';
import * as schema from '../drizzle/schema';

type StorageProviderType = 'local' | 'minio' | 's3';

export type SeedOptions = {
  /**
   * When true (boot path): only create org+providers if zero orgs exist.
   * Always ensures the admin user exists.
   * Does not recreate a deleted seed org while other orgs remain.
   */
  onlyIfEmpty?: boolean;
};

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly orgProcessors: OrgProcessorsService,
  ) {}

  async seed(options: SeedOptions = {}): Promise<void> {
    this.logger.log(
      `Seeding database${options.onlyIfEmpty ? ' (only if empty)' : ''}...`,
    );

    const admin = await this.seedAdminUser();

    const orgCount = await this.countOrgs();
    const providerCount = await this.countProviders();

    // Boot path: if orgs and providers already exist, still ensure owner membership.
    if (options.onlyIfEmpty && orgCount > 0 && providerCount > 0) {
      const org = await this.ensureSeedOrg();
      await this.ensureOwnerMembership(org.id, admin);
      this.logger.log(
        `Skipping org/provider seed — ${orgCount} org(s), ${providerCount} provider(s) already exist`,
      );
      return;
    }

    const org = await this.ensureSeedOrg();
    await this.orgProcessors.ensureDefaults(org.id);
    await this.ensureOwnerMembership(org.id, admin);

    // Seed providers when missing (covers migration-created org with no
    // providers) but never inject them into an org a user created themselves.
    if (!options.onlyIfEmpty || orgCount === 0 || this.isSeedOwnedOrg(org)) {
      await this.seedStorageProviders(org.id);
    } else {
      this.logger.log(
        `Skipping provider seed — org ${org.slug} was not created by the seeder`,
      );
    }

    if (process.env.AUTH_DEFAULT_ORG_ID !== org.id) {
      this.logger.warn(
        `Set AUTH_DEFAULT_ORG_ID=${org.id} for static AUTH_API_KEYS to bind to this org`,
      );
    }
    this.logger.log(`Seeding completed (org slug=${org.slug} id=${org.id})`);
  }

  private async countOrgs(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.organizations);
    return row?.count ?? 0;
  }

  private async countProviders(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.storageProviders);
    return row?.count ?? 0;
  }

  private seedOrgSlug(): string {
    return (
      (process.env.SEED_ORG_SLUG || 'allyfe').trim().toLowerCase() || 'allyfe'
    );
  }

  /** The seeder owns its own org and the migration-created `default` org only. */
  private isSeedOwnedOrg(org: schema.Organization): boolean {
    return org.slug === this.seedOrgSlug() || org.slug === 'default';
  }

  private async ensureSeedOrg(): Promise<schema.Organization> {
    const slug = this.seedOrgSlug();
    const name = (process.env.SEED_ORG_NAME || 'Allyfe').trim() || 'Allyfe';

    const [bySlug] = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, slug))
      .limit(1);
    if (bySlug) {
      this.logger.log(`Seed organization exists: ${bySlug.id} (${bySlug.slug})`);
      return bySlug;
    }

    // Prefer any existing org (e.g. migration-created `default`) over inserting another.
    const [anyOrg] = await this.db.select().from(schema.organizations).limit(1);
    if (anyOrg) {
      this.logger.log(
        `Using existing organization ${anyOrg.slug} (${anyOrg.id}) for provider seed`,
      );
      return anyOrg;
    }

    const [org] = await this.db
      .insert(schema.organizations)
      .values({
        slug,
        name,
        status: 'active',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@allyfe.org',
      })
      .returning();
    this.logger.log(`Created seed organization: ${org.id} (${org.slug})`);
    return org;
  }

  private async seedAdminUser(): Promise<schema.AdminUser> {
    const email = (
      process.env.ADMIN_EMAIL || 'admin@allyfe.org'
    )
      .trim()
      .toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin';
    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing) {
      if (existing.role !== 'admin') {
        const [promoted] = await this.db
          .update(schema.users)
          .set({ role: 'admin', updatedAt: new Date() })
          .where(eq(schema.users.id, existing.id))
          .returning();
        this.logger.log(`Promoted seed user "${email}" to platform admin`);
        return promoted;
      }
      this.logger.log(`Admin user "${email}" already exists`);
      return existing;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await this.db
      .insert(schema.users)
      .values({
        email,
        passwordHash,
        role: 'admin',
        isActive: true,
      })
      .returning();
    this.logger.log(`Created admin user ${email}`);
    return created;
  }

  private async ensureOwnerMembership(
    orgId: string,
    user: schema.AdminUser,
  ): Promise<void> {
    const [membership] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.orgId, orgId),
          eq(schema.organizationMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (membership) {
      this.logger.log(`Owner membership already exists for ${user.email}`);
      return;
    }

    await this.db.insert(schema.organizationMembers).values({
      orgId,
      userId: user.id,
      role: 'owner',
      status: 'active',
      email: user.email.trim().toLowerCase(),
      acceptedAt: new Date(),
      token: null,
    });
    this.logger.log(`Created owner membership for ${user.email}`);
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
        endpoint: process.env.MINIO_ENDPOINT?.trim() || 'minio',
        port: process.env.MINIO_PORT || '9000',
        browserEndpoint: process.env.MINIO_BROWSER_ENDPOINT?.trim() || '',
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
      name: process.env.AWS_S3_PROVIDER_NAME?.trim() || 'AWS S3 Storage',
      type: 's3',
      config: {
        region: process.env.AWS_S3_REGION?.trim() || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET?.trim() || 'your-bucket-name',
        endpoint: process.env.AWS_S3_ENDPOINT?.trim() || '',
        publicEndpoint: process.env.AWS_S3_PUBLIC_ENDPOINT?.trim() || '',
        forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID?.trim() || 'your-access-key',
        secretAccessKey:
          process.env.AWS_S3_SECRET_ACCESS_KEY?.trim() || 'your-secret-key',
      },
      isActive: s3Configured ? process.env.AWS_S3_ACTIVE !== 'false' : false,
      isDefault: s3Configured && process.env.AWS_S3_DEFAULT === 'true',
    });
  }
}
