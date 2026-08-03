import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ApiKeyService as CommonApiKeyService } from '../../common/services/api-key.service';
import * as schema from '../../database/drizzle/schema';

@Injectable()
export class AdminApiKeyService {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly commonApiKeyService: CommonApiKeyService,
  ) {}

  async list(orgId: string): Promise<schema.ApiKey[]> {
    return this.db
      .select()
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.orgId, orgId))
      .orderBy(schema.apiKeys.createdAt);
  }

  async findById(id: string, orgId: string): Promise<schema.ApiKey | null> {
    const [key] = await this.db
      .select()
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.orgId, orgId)))
      .limit(1);

    return key || null;
  }

  async create(data: {
    serviceName: string;
    orgId: string;
    permissions?: any;
    expiresAt?: Date;
  }): Promise<{ apiKey: schema.ApiKey; plainKey: string }> {
    const plainKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = await this.commonApiKeyService.hashApiKey(plainKey);

    const [apiKey] = await this.db
      .insert(schema.apiKeys)
      .values({
        serviceName: data.serviceName,
        orgId: data.orgId,
        keyHash,
        permissions: data.permissions || null,
        expiresAt: data.expiresAt || null,
        isActive: true,
      } as typeof schema.apiKeys.$inferInsert)
      .returning();

    return { apiKey, plainKey };
  }

  async update(
    id: string,
    data: Partial<{
      permissions: any;
      expiresAt: Date | null;
      isActive: boolean;
    }>,
    orgId: string,
  ): Promise<schema.ApiKey | null> {
    const existing = await this.findById(id, orgId);
    if (!existing) return null;

    const updateData: any = {};

    if (data.permissions !== undefined) {
      updateData.permissions = data.permissions;
    }
    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const [apiKey] = await this.db
      .update(schema.apiKeys)
      .set(updateData)
      .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.orgId, orgId)))
      .returning();

    return apiKey || null;
  }

  async delete(id: string, orgId: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.apiKeys)
      .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.orgId, orgId)))
      .returning();

    return result.length > 0;
  }
}
