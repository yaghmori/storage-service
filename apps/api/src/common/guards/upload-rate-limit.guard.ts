import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import type { OrgUploadRateLimit } from '../../organizations/types/org-limits';

/**
 * HTTP rate limiter that skips:
 * - health checks
 * - service names listed in RATE_LIMIT_EXEMPT_SERVICE_NAMES (comma-separated)
 * - API keys whose permissions JSON includes rateLimitExempt / migration: true
 * - when RATE_LIMIT_DISABLED=true
 *
 * Limit / TTL resolution (first positive wins):
 * 1. api_keys.permissions.rateLimitMax / rateLimitTtlMs
 * 2. organizations.metadata.limits.uploadRateLimitMax / uploadRateLimitTtlMs
 * 3. RATE_LIMIT_MAX / RATE_LIMIT_TTL_MS env (defaults 120 / 60000)
 *
 * Tracker: upload:org:{orgId}:svc:{serviceName} (falls back to IP).
 *
 * Migration tip: name the migrate key `migration` (or list it in
 * RATE_LIMIT_EXEMPT_SERVICE_NAMES) and/or set permissions.migration=true /
 * permissions.rateLimitExempt=true. Prefer skipProcessing on bulk uploads so
 * processor queues stay empty.
 *
 * Permissions contract:
 * {
 *   rateLimitExempt?: boolean;
 *   migration?: boolean;
 *   rateLimitMax?: number;     // positive int
 *   rateLimitTtlMs?: number;   // positive int, window size
 * }
 */
@Injectable()
export class UploadRateLimitGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // Throttler is HTTP-only; Nest TCP/RPC has no request path/IP.
    if (context.getType() !== 'http') {
      return true;
    }

    if (
      this.config.get<string>('RATE_LIMIT_DISABLED') === 'true' ||
      this.config.get<string>('RATE_LIMIT_DISABLED') === '1'
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      path?: string;
      url?: string;
      serviceName?: string;
      apiKeyPermissions?: unknown;
    }>();

    const path = request.path || request.url || '';
    if (path.includes('/health')) return true;

    const exemptNames = (
      this.config.get<string>('RATE_LIMIT_EXEMPT_SERVICE_NAMES') ||
      'migration,storage-migrate,eallyfe-migrate'
    )
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const serviceName = request.serviceName?.trim().toLowerCase();
    if (serviceName && exemptNames.includes(serviceName)) {
      return true;
    }

    const perms = request.apiKeyPermissions;
    if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
      const p = perms as Record<string, unknown>;
      if (p.rateLimitExempt === true || p.migration === true) {
        return true;
      }
    }

    return false;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const orgId =
      typeof req.orgId === 'string' && req.orgId.trim()
        ? req.orgId.trim()
        : null;
    const serviceName =
      typeof req.serviceName === 'string' && req.serviceName.trim()
        ? req.serviceName.trim().toLowerCase()
        : null;
    if (orgId && serviceName) {
      return `upload:org:${orgId}:svc:${serviceName}`;
    }
    if (serviceName) {
      return `upload:svc:${serviceName}`;
    }
    return typeof req.ip === 'string' && req.ip ? req.ip : 'anonymous';
  }

  /**
   * Apply per-key / per-org limit+ttl before the default increment logic.
   * Nest throttler 6 resolves limit/ttl before handleRequest; we re-resolve here.
   */
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { limit, ttl } = this.resolveUploadRate(requestProps.context);
    return super.handleRequest({
      ...requestProps,
      limit,
      ttl,
      blockDuration: ttl,
    });
  }

  private resolveUploadRate(context: ExecutionContext): {
    limit: number;
    ttl: number;
  } {
    const envLimit = this.parsePositiveInt(
      this.config.get<string>('RATE_LIMIT_MAX'),
      120,
    );
    const envTtl = this.parsePositiveInt(
      this.config.get<string>('RATE_LIMIT_TTL_MS'),
      60_000,
    );

    if (context.getType() !== 'http') {
      return { limit: envLimit, ttl: envTtl };
    }

    const request = context.switchToHttp().getRequest<{
      apiKeyPermissions?: unknown;
      orgUploadRateLimit?: OrgUploadRateLimit;
    }>();

    const keyLimit = this.positiveFromUnknown(
      this.permNumber(request.apiKeyPermissions, 'rateLimitMax'),
    );
    const keyTtl = this.positiveFromUnknown(
      this.permNumber(request.apiKeyPermissions, 'rateLimitTtlMs'),
    );
    const orgLimit = this.positiveFromUnknown(
      request.orgUploadRateLimit?.uploadRateLimitMax,
    );
    const orgTtl = this.positiveFromUnknown(
      request.orgUploadRateLimit?.uploadRateLimitTtlMs,
    );

    return {
      limit: keyLimit ?? orgLimit ?? envLimit,
      ttl: keyTtl ?? orgTtl ?? envTtl,
    };
  }

  private permNumber(perms: unknown, key: string): unknown {
    if (!perms || typeof perms !== 'object' || Array.isArray(perms)) {
      return undefined;
    }
    return (perms as Record<string, unknown>)[key];
  }

  private positiveFromUnknown(value: unknown): number | null {
    if (value == null) return null;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
}
