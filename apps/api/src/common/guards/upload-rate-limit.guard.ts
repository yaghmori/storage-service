import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * HTTP rate limiter that skips:
 * - health checks
 * - service names listed in RATE_LIMIT_EXEMPT_SERVICE_NAMES (comma-separated)
 * - API keys whose permissions JSON includes rateLimitExempt / migration: true
 * - when RATE_LIMIT_DISABLED=true
 *
 * Migration tip: name the migrate key `migration` (or list it in
 * RATE_LIMIT_EXEMPT_SERVICE_NAMES) and/or set permissions.migration=true.
 * Prefer skipProcessing on bulk uploads so processor queues stay empty.
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
}
