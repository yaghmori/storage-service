import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'crypto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

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

function verifyHs256Jwt(token: string, secret: string): { serviceName?: string } | null {
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
      exp?: number;
    };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Configurable HTTP auth for storage-service.
 * Same client contract as email-service: Bearer JWT and/or x-api-key.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (authDisabled()) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = (request.headers.authorization || '') as string;
    const jwtSecret = process.env.JWT_SECRET || '';

    if (authHeader.startsWith('Bearer ') && jwtSecret) {
      const payload = verifyHs256Jwt(authHeader.slice(7), jwtSecret);
      if (payload?.serviceName) {
        request.serviceName = payload.serviceName;
        request.user = { serviceName: payload.serviceName };
        return true;
      }
    }

    const apiKey =
      (request.headers['x-api-key'] as string | undefined) ||
      (authHeader.startsWith('ApiKey ') ? authHeader.slice(7) : undefined);

    if (apiKey && staticApiKeys().has(apiKey)) {
      request.serviceName = process.env.AUTH_SERVICE_NAME || 'static-client';
      request.user = { serviceName: request.serviceName };
      return true;
    }

    // If no secrets configured, fail closed unless AUTH_DISABLED
    throw new UnauthorizedException(
      'Valid JWT (Authorization: Bearer) or API key (x-api-key) required. Configure AUTH_API_KEYS / JWT_SECRET, or AUTH_DISABLED=true on trusted networks.',
    );
  }
}
