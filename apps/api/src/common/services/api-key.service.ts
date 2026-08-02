import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';

@Injectable()
export class ApiKeyService {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async hashApiKey(apiKey: string): Promise<string> {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  async verifyApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; serviceName?: string; orgId?: string }> {
    const keyHash = await this.hashApiKey(apiKey.trim());

    const [apiKeyRecord] = await this.db
      .select({
        serviceName: schema.apiKeys.serviceName,
        orgId: schema.apiKeys.orgId,
        orgStatus: schema.organizations.status,
      })
      .from(schema.apiKeys)
      .innerJoin(
        schema.organizations,
        eq(schema.apiKeys.orgId, schema.organizations.id),
      )
      .where(
        and(
          eq(schema.apiKeys.keyHash, keyHash),
          eq(schema.apiKeys.isActive, true),
          or(
            isNull(schema.apiKeys.expiresAt),
            gt(schema.apiKeys.expiresAt, new Date()),
          ),
        ),
      )
      .limit(1);

    if (!apiKeyRecord || apiKeyRecord.orgStatus !== 'active') {
      return { valid: false };
    }

    return {
      valid: true,
      serviceName: apiKeyRecord.serviceName,
      orgId: apiKeyRecord.orgId,
    };
  }
}
