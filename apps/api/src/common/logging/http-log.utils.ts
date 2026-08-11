import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

const PROBE_PATTERNS = [
  /\.\./,
  /%2e%2e/i,
  /etc\/passwd/i,
  /\.env\b/i,
  /wp-admin/i,
  /wp-login/i,
  /\.git\b/i,
  /phpmyadmin/i,
];

export type HttpRequestLike = {
  id?: string;
  method?: string;
  url?: string;
  originalUrl?: string;
  ip?: string;
  correlationId?: string;
  startTime?: number;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
};

export function resolveLogLevel(): string {
  const raw = (process.env.LOG_LEVEL || 'info').toLowerCase();
  // Nest historically used "log"/"verbose" — map to Pino levels.
  const level = raw === 'log' ? 'info' : raw === 'verbose' ? 'debug' : raw;
  return ['debug', 'info', 'warn', 'error', 'fatal', 'trace'].includes(level)
    ? level
    : 'info';
}

export function shouldUsePrettyLogs(): boolean {
  if (process.env.LOG_PRETTY === 'true') return true;
  if (process.env.LOG_PRETTY === 'false') return false;
  return process.env.NODE_ENV === 'development';
}

export function isSecurityProbePath(path: string | undefined): boolean {
  if (!path) return false;
  return PROBE_PATTERNS.some((re) => re.test(path));
}

export function clientIp(req: HttpRequestLike): string | undefined {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim();
  }
  return req.ip || req.socket?.remoteAddress;
}

export function requestPath(req: HttpRequestLike): string {
  return req.originalUrl || req.url || '';
}

export function userAgent(req: HttpRequestLike): string | undefined {
  const ua = req.headers?.['user-agent'];
  return typeof ua === 'string' ? ua : Array.isArray(ua) ? ua[0] : undefined;
}

export function durationMs(req: HttpRequestLike): number | undefined {
  if (typeof req.startTime !== 'number') return undefined;
  return Date.now() - req.startTime;
}

export function genReqId(
  req: IncomingMessage & { id?: string },
  res: ServerResponse,
): string {
  const headerId = req.headers['x-request-id'];
  const existing =
    (typeof req.id === 'string' && req.id) ||
    (typeof headerId === 'string' && headerId) ||
    (Array.isArray(headerId) ? headerId[0] : undefined);

  const id = existing && existing.trim() ? existing : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  return id;
}

export function isIgnoredAccessPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0] || '';
  return (
    path === '/health' ||
    path === '/metrics' ||
    path.endsWith('/health') ||
    path.endsWith('/metrics')
  );
}

export function exceptionLogLevel(
  statusCode: number,
  path: string | undefined,
): 'error' | 'warn' | 'info' {
  if (statusCode >= 500) return 'error';
  if (isSecurityProbePath(path)) return 'warn';
  if (statusCode === 400) return 'warn';
  if (statusCode >= 400 && statusCode < 500) return 'info';
  return 'info';
}
