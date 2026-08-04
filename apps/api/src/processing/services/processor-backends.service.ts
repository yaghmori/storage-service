import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  last4,
} from '../../common/utils/secret-encryption.util';
import { ProcessorConfig } from '../../config/processor.config';
import * as schema from '../../database/drizzle/schema';
import { OpenaiCompatibleClient } from './openai-compatible.client';

export type ResolvedOpenaiCompatibleBackend = {
  backendId: string | null;
  kind: 'openai_compatible';
  baseUrl: string;
  apiKey?: string;
  visionModel: string;
  textModel?: string;
  timeoutMs: number;
  source: 'org' | 'platform';
};

@Injectable()
export class ProcessorBackendsService {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly processorConfig: ProcessorConfig,
    private readonly openai: OpenaiCompatibleClient,
  ) {}

  async listByOrg(orgId: string) {
    return this.db
      .select()
      .from(schema.processorBackends)
      .where(eq(schema.processorBackends.orgId, orgId))
      .orderBy(schema.processorBackends.createdAt);
  }

  async getById(id: string, orgId: string) {
    const [row] = await this.db
      .select()
      .from(schema.processorBackends)
      .where(
        and(
          eq(schema.processorBackends.id, id),
          eq(schema.processorBackends.orgId, orgId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  toPublic(row: schema.ProcessorBackend) {
    const config = (row.config ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      orgId: row.orgId,
      name: row.name,
      kind: row.kind,
      isActive: row.isActive,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : '',
      apiKeyConfigured: Boolean(config.apiKeyEncrypted),
      apiKeyLast4:
        typeof config.apiKeyLast4 === 'string' ? config.apiKeyLast4 : null,
      visionModel:
        typeof (config.defaultModels as { vision?: string } | undefined)
          ?.vision === 'string'
          ? (config.defaultModels as { vision: string }).vision
          : null,
      textModel:
        typeof (config.defaultModels as { text?: string } | undefined)?.text ===
        'string'
          ? (config.defaultModels as { text: string }).text
          : null,
      timeoutMs:
        typeof config.timeoutMs === 'number' ? config.timeoutMs : null,
    };
  }

  async create(
    orgId: string,
    input: {
      name: string;
      kind: string;
      isActive?: boolean;
      isDefault?: boolean;
      baseUrl: string;
      apiKey?: string;
      visionModel?: string;
      textModel?: string;
      timeoutMs?: number;
    },
  ) {
    if (input.isDefault) {
      await this.clearDefault(orgId, input.kind);
    }

    const config = this.buildStoredConfig(input, null);
    const [row] = await this.db
      .insert(schema.processorBackends)
      .values({
        orgId,
        name: input.name.trim(),
        kind: input.kind,
        config,
        isActive: input.isActive ?? true,
        isDefault: input.isDefault ?? false,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    orgId: string,
    input: {
      name?: string;
      isActive?: boolean;
      isDefault?: boolean;
      baseUrl?: string;
      apiKey?: string;
      clearApiKey?: boolean;
      visionModel?: string;
      textModel?: string;
      timeoutMs?: number;
    },
  ) {
    const existing = await this.getById(id, orgId);
    if (!existing) throw new NotFoundException('Processor backend not found');

    if (input.isDefault) {
      await this.clearDefault(orgId, existing.kind, id);
    }

    const config = this.buildStoredConfig(
      {
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        clearApiKey: input.clearApiKey,
        visionModel: input.visionModel,
        textModel: input.textModel,
        timeoutMs: input.timeoutMs,
      },
      existing.config as Record<string, unknown>,
    );

    const [row] = await this.db
      .update(schema.processorBackends)
      .set({
        name: input.name?.trim() ?? existing.name,
        isActive: input.isActive ?? existing.isActive,
        isDefault: input.isDefault ?? existing.isDefault,
        config,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.processorBackends.id, id),
          eq(schema.processorBackends.orgId, orgId),
        ),
      )
      .returning();
    return row;
  }

  async delete(id: string, orgId: string) {
    const [row] = await this.db
      .delete(schema.processorBackends)
      .where(
        and(
          eq(schema.processorBackends.id, id),
          eq(schema.processorBackends.orgId, orgId),
        ),
      )
      .returning();
    return row ?? null;
  }

  /**
   * Resolve model name for a job.
   * Order: job override → processor settings → backend defaults → error.
   */
  resolveModel(input: {
    role: 'vision' | 'text';
    jobOverride?: string | null;
    processorModels?: { vision?: string; text?: string } | null;
    backend: Pick<ResolvedOpenaiCompatibleBackend, 'visionModel' | 'textModel'>;
  }): string {
    const fromJob = input.jobOverride?.trim();
    if (fromJob) return fromJob;

    const fromProcessor =
      input.role === 'vision'
        ? input.processorModels?.vision?.trim()
        : input.processorModels?.text?.trim();
    if (fromProcessor) return fromProcessor;

    const fromBackend =
      input.role === 'vision'
        ? input.backend.visionModel?.trim()
        : input.backend.textModel?.trim();
    if (fromBackend) return fromBackend;

    throw new Error(
      `No ${input.role} model configured. Set it on the processor settings or as a backend fallback.`,
    );
  }

  /**
   * Resolve OpenAI-compatible credentials for a job:
   * explicit backendId → org default for kind → platform env.
   * Model names on the backend are optional fallbacks only.
   */
  async resolveOpenaiCompatible(
    orgId: string,
    backendId?: string | null,
  ): Promise<ResolvedOpenaiCompatibleBackend | null> {
    let row: schema.ProcessorBackend | null = null;
    if (backendId) {
      row = await this.getById(backendId, orgId);
    }
    if (!row) {
      const [def] = await this.db
        .select()
        .from(schema.processorBackends)
        .where(
          and(
            eq(schema.processorBackends.orgId, orgId),
            eq(schema.processorBackends.kind, 'openai_compatible'),
            eq(schema.processorBackends.isActive, true),
            eq(schema.processorBackends.isDefault, true),
          ),
        )
        .limit(1);
      row = def ?? null;
    }
    if (!row) {
      const [anyActive] = await this.db
        .select()
        .from(schema.processorBackends)
        .where(
          and(
            eq(schema.processorBackends.orgId, orgId),
            eq(schema.processorBackends.kind, 'openai_compatible'),
            eq(schema.processorBackends.isActive, true),
          ),
        )
        .limit(1);
      row = anyActive ?? null;
    }

    if (row) {
      const config = row.config as Record<string, unknown>;
      const baseUrl =
        typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '';
      if (!baseUrl) return null;
      let apiKey: string | undefined;
      if (
        typeof config.apiKeyEncrypted === 'string' &&
        isEncryptedSecret(config.apiKeyEncrypted)
      ) {
        apiKey = decryptSecret(
          config.apiKeyEncrypted,
          this.processorConfig.credentialsEncryptionKey,
        );
      }
      const models = (config.defaultModels ?? {}) as {
        vision?: string;
        text?: string;
      };
      const platform = this.processorConfig.openaiCompatibleDefaults;
      return {
        backendId: row.id,
        kind: 'openai_compatible',
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiKey,
        visionModel: models.vision?.trim() || platform.visionModel || '',
        textModel: models.text?.trim() || platform.textModel || '',
        timeoutMs:
          typeof config.timeoutMs === 'number'
            ? config.timeoutMs
            : platform.timeoutMs,
        source: 'org',
      };
    }

    const platform = this.processorConfig.openaiCompatibleDefaults;
    if (!platform.baseUrl) return null;
    return {
      backendId: null,
      kind: 'openai_compatible',
      baseUrl: platform.baseUrl.replace(/\/+$/, ''),
      apiKey: platform.apiKey,
      visionModel: platform.visionModel || '',
      textModel: platform.textModel || '',
      timeoutMs: platform.timeoutMs,
      source: 'platform',
    };
  }

  /**
   * Resolve ClamAV/clamd endpoint: explicit backendId → org default clamav → null.
   * Config shape: { host, port, timeoutMs } or { baseUrl: "host:port" }.
   */
  async resolveClamav(
    orgId: string,
    backendId?: string | null,
  ): Promise<{ host: string; port: number; timeoutMs: number } | null> {
    let row: schema.ProcessorBackend | null = null;
    if (backendId) {
      row = await this.getById(backendId, orgId);
      if (row && row.kind !== 'clamav') row = null;
    }
    if (!row) {
      const [def] = await this.db
        .select()
        .from(schema.processorBackends)
        .where(
          and(
            eq(schema.processorBackends.orgId, orgId),
            eq(schema.processorBackends.kind, 'clamav'),
            eq(schema.processorBackends.isActive, true),
            eq(schema.processorBackends.isDefault, true),
          ),
        )
        .limit(1);
      row = def ?? null;
    }
    if (!row) {
      const [anyActive] = await this.db
        .select()
        .from(schema.processorBackends)
        .where(
          and(
            eq(schema.processorBackends.orgId, orgId),
            eq(schema.processorBackends.kind, 'clamav'),
            eq(schema.processorBackends.isActive, true),
          ),
        )
        .limit(1);
      row = anyActive ?? null;
    }
    if (!row) return null;

    const config = (row.config ?? {}) as Record<string, unknown>;
    let host =
      typeof config.host === 'string' ? config.host.trim() : '';
    let port =
      typeof config.port === 'number'
        ? config.port
        : parseInt(String(config.port ?? ''), 10);
    if (!host && typeof config.baseUrl === 'string') {
      const raw = config.baseUrl.trim().replace(/^https?:\/\//i, '');
      const [h, p] = raw.split(':');
      host = h || '';
      if (p && /^\d+$/.test(p)) port = parseInt(p, 10);
    }
    if (!host) return null;
    return {
      host,
      port: Number.isFinite(port) && port > 0 ? port : 3310,
      timeoutMs:
        typeof config.timeoutMs === 'number' && config.timeoutMs > 0
          ? config.timeoutMs
          : 120_000,
    };
  }

  async listModels(
    orgId: string,
    backendId: string,
  ): Promise<{ id: string; ownedBy?: string }[]> {
    const resolved = await this.resolveOpenaiCompatible(orgId, backendId);
    if (!resolved || resolved.backendId !== backendId) {
      throw new NotFoundException('Processor backend not found');
    }
    return this.openai.listModels({
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      timeoutMs: Math.min(resolved.timeoutMs, 30_000),
    });
  }

  private async clearDefault(orgId: string, kind: string, exceptId?: string) {
    const conditions = [
      eq(schema.processorBackends.orgId, orgId),
      eq(schema.processorBackends.kind, kind),
      eq(schema.processorBackends.isDefault, true),
    ];
    if (exceptId) {
      conditions.push(ne(schema.processorBackends.id, exceptId));
    }
    await this.db
      .update(schema.processorBackends)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(...conditions));
  }

  private buildStoredConfig(
    input: {
      baseUrl?: string;
      apiKey?: string;
      clearApiKey?: boolean;
      visionModel?: string;
      textModel?: string;
      timeoutMs?: number;
    },
    existing: Record<string, unknown> | null,
  ): Record<string, unknown> {
    const base = { ...(existing ?? {}) };
    if (input.baseUrl !== undefined) {
      base.baseUrl = input.baseUrl.trim().replace(/\/+$/, '');
    }

    if (input.clearApiKey) {
      delete base.apiKeyEncrypted;
      delete base.apiKeyLast4;
    } else if (input.apiKey !== undefined && input.apiKey.trim()) {
      const key = this.processorConfig.credentialsEncryptionKey;
      if (!key) {
        throw new Error(
          'PROCESSOR_CREDENTIALS_ENCRYPTION_KEY must be set to store API keys',
        );
      }
      base.apiKeyEncrypted = encryptSecret(input.apiKey.trim(), key);
      base.apiKeyLast4 = last4(input.apiKey);
    }

    const models = {
      ...((base.defaultModels as Record<string, string> | undefined) ?? {}),
    };
    if (input.visionModel !== undefined) {
      if (input.visionModel.trim()) models.vision = input.visionModel.trim();
      else delete models.vision;
    }
    if (input.textModel !== undefined) {
      if (input.textModel.trim()) models.text = input.textModel.trim();
      else delete models.text;
    }
    base.defaultModels = models;

    if (input.timeoutMs !== undefined) {
      base.timeoutMs = input.timeoutMs;
    }

    return base;
  }
}
