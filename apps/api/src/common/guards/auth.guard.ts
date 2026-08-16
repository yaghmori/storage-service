import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'crypto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiKeyService } from '../services/api-key.service';
import {
  filesSigningSecret,
  parseFileDownloadPath,
  verifyFileDownloadHmac,
} from '../../serving/utils/file-download-hmac';

function authDisabled(): boolean {
  const mode = (process.env.AUTH_MODE || '').toLowerCase();
  return (
    process.env.AUTH_DISABLED === 'true' ||
    process.env.AUTH_DISABLED === '1' ||
    mode === 'disabled' ||
    mode === 'none' ||
    mode === 'off'
  );
}

function staticApiKeys(): Set<string> {
  const raw = process.env.AUTH_API_KEYS || process.env.AUTH_API_KEY || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function verifyHs256Jwt(
  token: string,
  secret: string,
): { serviceName?: string; orgId?: string } | null {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const data = `${h}.${p}`;
    const expected = createHmac('sha256', secret).update(data).digest('base64url');
    const a = Buffer.from(expected);
    const b = Buffer.from(s);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as {
      serviceName?: string;
      orgId?: string;
      exp?: number;
    };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * HTTP auth for core storage routes (`/api/*`).
 * API keys are bound to an organization; request.orgId is set from the key.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ApiKeyService) private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Nest TCP / RPC is for internal service mesh — use network isolation, not HTTP API keys.
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (authDisabled()) return true;

    const request = context.switchToHttp().getRequest();
    if (this.allowHmacFileDownload(request)) {
      return true;
    }
    const authHeader = (request.headers.authorization || '') as string;
    const jwtSecret = process.env.JWT_SECRET || '';

    if (authHeader.startsWith('Bearer ') && jwtSecret) {
      const payload = verifyHs256Jwt(authHeader.slice(7), jwtSecret);
      if (payload?.serviceName) {
        request.serviceName = payload.serviceName;
        request.orgId = payload.orgId || process.env.AUTH_DEFAULT_ORG_ID || undefined;
        request.user = {
          serviceName: request.serviceName,
          orgId: request.orgId,
        };
        return true;
      }
    }

    const apiKeyRaw =
      (request.headers['x-api-key'] as string | undefined) ||
      (authHeader.startsWith('ApiKey ') ? authHeader.slice(7) : undefined);
    const apiKey = apiKeyRaw?.trim();

    if (apiKey) {
      const staticKeys = staticApiKeys();
      if (staticKeys.has(apiKey)) {
        request.serviceName = process.env.AUTH_SERVICE_NAME || 'static-client';
        request.orgId = process.env.AUTH_DEFAULT_ORG_ID || undefined;
        request.user = {
          serviceName: request.serviceName,
          orgId: request.orgId,
        };
        return true;
      }

      const verification = await this.apiKeyService.verifyApiKey(apiKey);
      if (verification.valid && verification.serviceName) {
        request.serviceName = verification.serviceName;
        request.orgId = verification.orgId;
        request.apiKeyPermissions = verification.permissions;
        request.orgUploadRateLimit = verification.orgUploadRateLimit;
        request.user = {
          serviceName: verification.serviceName,
          orgId: verification.orgId,
        };
        return true;
      }
    }

    throw new UnauthorizedException(
      'Valid JWT (Authorization: Bearer), API key (x-api-key), or HMAC download signature required. Configure AUTH_API_KEYS / DB api_keys / JWT_SECRET / FILES_SIGNING_SECRET, or AUTH_DISABLED=true on trusted networks.',
    );
  }

  private allowHmacFileDownload(request: {
    path?: string;
    url?: string;
    originalUrl?: string;
    query?: Record<string, unknown>;
    fileDownloadHmac?: { fileId: string; exp: number; variant?: string };
  }): boolean {
    const path = (request.path || request.originalUrl || request.url || '')
      .split('?')[0];
    const fileId = parseFileDownloadPath(path);
    if (!fileId) return false;

    const expRaw = firstQuery(request.query?.exp);
    const sig = firstQuery(request.query?.sig) || '';
    const variant = firstQuery(request.query?.variant);
    const exp = Number(expRaw);
    const secret = filesSigningSecret();
    if (!verifyFileDownloadHmac({ fileId, exp, variant }, sig, secret)) {
      return false;
    }
    request.fileDownloadHmac = { fileId, exp, variant };
    return true;
  }
}

function firstQuery(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

/** Enforce body/header orgId matches the API key's organization. */
export function resolveBoundOrgId(
  request: {
    orgId?: string;
    headers?: Record<string, string | string[] | undefined>;
  },
  bodyOrgId?: string | null,
): string | undefined {
  const headerRaw = request.headers?.['x-org-id'];
  const headerOrgId = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const keyOrgId = request.orgId?.trim() || undefined;
  const requested = (bodyOrgId || headerOrgId || undefined)?.trim() || undefined;

  if (keyOrgId && requested && requested !== keyOrgId) {
    throw new ForbiddenException('orgId does not match the API key organization');
  }
  return keyOrgId || requested;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}
