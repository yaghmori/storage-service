import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/drizzle/schema';

export type UpsertOrganizationInput = {
  slug: string;
  name: string;
  status?: 'active' | 'suspended';
  externalRef?: string | null;
  logoUrl?: string | null;
  frontendBaseUrl?: string | null;
  customDomain?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  supportEmail?: string | null;
  privacyUrl?: string | null;
  termsUrl?: string | null;
  appBaseUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

const DEFAULT_ORG_SLUG = 'default';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async list(): Promise<schema.Organization[]> {
    return this.db.select().from(schema.organizations).orderBy(asc(schema.organizations.name));
  }

  async getById(id: string): Promise<schema.Organization | null> {
    const [row] = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, id))
      .limit(1);
    return row ?? null;
  }

  async getBySlug(slug: string): Promise<schema.Organization | null> {
    const [row] = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async getDefault(): Promise<schema.Organization | null> {
    const preferredId = process.env.AUTH_DEFAULT_ORG_ID?.trim();
    if (preferredId) {
      const byId = await this.getById(preferredId);
      if (byId) return byId;
    }
    const bySlug = await this.getBySlug(DEFAULT_ORG_SLUG);
    if (bySlug) return bySlug;
    const [first] = await this.db
      .select()
      .from(schema.organizations)
      .orderBy(asc(schema.organizations.createdAt))
      .limit(1);
    return first ?? null;
  }

  async resolveOrgRef(input: {
    orgId?: string | null;
    orgSlug?: string | null;
  }): Promise<string | undefined> {
    const orgId = input.orgId?.trim() || undefined;
    const orgSlug = input.orgSlug?.trim() || undefined;
    if (!orgId && !orgSlug) return undefined;

    if (orgSlug === '~') {
      throw new BadRequestException('Organization slug "~" is reserved');
    }

    if (orgId) {
      const byId = await this.getById(orgId);
      if (!byId) {
        throw new BadRequestException(`Unknown orgId: ${orgId}`);
      }
      if (orgSlug && byId.slug !== orgSlug) {
        throw new BadRequestException('orgId and orgSlug do not match');
      }
      return byId.id;
    }

    const bySlug = await this.getBySlug(orgSlug!);
    if (!bySlug) {
      throw new BadRequestException(`Unknown orgSlug: ${orgSlug}`);
    }
    return bySlug.id;
  }

  /**
   * Create a bootstrap org only when the table is empty.
   * Does not recreate a deleted seed/"default" org while others exist.
   */
  async ensureDefault(frontendBaseUrl?: string | null): Promise<schema.Organization> {
    const existing = await this.getDefault();
    if (existing) return existing;

    const [anyOrg] = await this.db
      .select()
      .from(schema.organizations)
      .limit(1);
    if (anyOrg) return anyOrg;

    const slug =
      (process.env.SEED_ORG_SLUG || DEFAULT_ORG_SLUG).trim() || DEFAULT_ORG_SLUG;
    const name = (process.env.SEED_ORG_NAME || 'Default').trim() || 'Default';
    const [row] = await this.db
      .insert(schema.organizations)
      .values({
        slug,
        name,
        status: 'active',
        frontendBaseUrl: frontendBaseUrl?.trim() || null,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
      } as schema.NewOrganization)
      .returning();
    return row;
  }

  async create(input: UpsertOrganizationInput): Promise<schema.Organization> {
    const slug = input.slug.trim();
    if (slug === '~' || slug === 'onboarding' || slug === 'platform' || slug === 'auth') {
      throw new BadRequestException(`Organization slug "${slug}" is reserved`);
    }

    const existing = await this.getBySlug(slug);
    if (existing) {
      throw new ConflictException(
        `An organization with this name already exists (slug "${slug}"). Choose a different name.`,
      );
    }

    try {
      const [row] = await this.db
        .insert(schema.organizations)
        .values({
          slug,
          name: input.name,
          status: input.status ?? 'active',
          externalRef: input.externalRef ?? null,
          logoUrl: input.logoUrl ?? null,
          frontendBaseUrl: input.frontendBaseUrl?.trim() || null,
          customDomain: input.customDomain ?? null,
          primaryColor: input.primaryColor ?? null,
          secondaryColor: input.secondaryColor ?? null,
          supportEmail: input.supportEmail ?? null,
          privacyUrl: input.privacyUrl ?? null,
          termsUrl: input.termsUrl ?? null,
          appBaseUrl: input.appBaseUrl ?? null,
          metadata: input.metadata ?? null,
        } as schema.NewOrganization)
        .returning();
      await this.cloneProvidersPack(row.id);
      return row;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === '23505') {
        throw new ConflictException(
          `An organization with this name already exists (slug "${slug}"). Choose a different name.`,
        );
      }
      throw error;
    }
  }

  /** Copy storage providers from default (or first) org so a new tenant is usable. */
  async cloneProvidersPack(targetOrgId: string): Promise<void> {
    const source =
      (await this.getDefault()) ??
      (
        await this.db
          .select()
          .from(schema.organizations)
          .where(ne(schema.organizations.id, targetOrgId))
          .limit(1)
      )[0];

    if (!source || source.id === targetOrgId) return;

    const sourceProviders = await this.db
      .select()
      .from(schema.storageProviders)
      .where(eq(schema.storageProviders.orgId, source.id));

    for (const p of sourceProviders) {
      await this.db.insert(schema.storageProviders).values({
        orgId: targetOrgId,
        name: p.name,
        type: p.type,
        config: p.config,
        isActive: p.isActive,
        isDefault: p.isDefault,
      });
    }

    this.logger.log(
      `Cloned ${sourceProviders.length} storage providers from org ${source.slug} → ${targetOrgId}`,
    );
  }

  async update(
    id: string,
    input: Partial<UpsertOrganizationInput>,
  ): Promise<schema.Organization> {
    const existing = await this.getById(id);
    if (!existing) throw new NotFoundException('Organization not found');

    if (input.slug !== undefined) {
      const slug = input.slug.trim();
      if (slug === '~' || slug === 'onboarding' || slug === 'platform' || slug === 'auth') {
        throw new BadRequestException(`Organization slug "${slug}" is reserved`);
      }
      const clash = await this.getBySlug(slug);
      if (clash && clash.id !== id) {
        throw new ConflictException(`Slug "${slug}" is already taken`);
      }
    }

    const [row] = await this.db
      .update(schema.organizations)
      .set({
        ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.externalRef !== undefined ? { externalRef: input.externalRef } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.frontendBaseUrl !== undefined
          ? { frontendBaseUrl: input.frontendBaseUrl?.trim() || null }
          : {}),
        ...(input.customDomain !== undefined ? { customDomain: input.customDomain } : {}),
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
        ...(input.secondaryColor !== undefined ? { secondaryColor: input.secondaryColor } : {}),
        ...(input.supportEmail !== undefined ? { supportEmail: input.supportEmail } : {}),
        ...(input.privacyUrl !== undefined ? { privacyUrl: input.privacyUrl } : {}),
        ...(input.termsUrl !== undefined ? { termsUrl: input.termsUrl } : {}),
        ...(input.appBaseUrl !== undefined ? { appBaseUrl: input.appBaseUrl } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, id))
      .returning();

    return row;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await this.db.delete(schema.organizations).where(eq(schema.organizations.id, id));
    return true;
  }
}
