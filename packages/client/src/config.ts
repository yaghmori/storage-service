import { ENV_KEYS, PORTS } from './generated';

export type ServiceEndpoint = {
  baseUrl?: string;
  host?: string;
  port?: number;
  protocol?: 'http' | 'https';
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function resolveHttpBaseUrl(options: ServiceEndpoint = {}): string {
  if (options.baseUrl) return options.baseUrl.replace(/\/$/, '');
  const fromEnv = env(ENV_KEYS.httpBaseUrl) ?? env('STORAGE_SERVICE_URL');
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const host = options.host ?? env(ENV_KEYS.host) ?? env('STORAGE_HOST') ?? '127.0.0.1';
  const port = Number(
    options.port ?? env(ENV_KEYS.httpPort) ?? env('STORAGE_HTTP_PORT') ?? PORTS.http,
  );
  const protocol = options.protocol ?? (port === 443 ? 'https' : 'http');
  const defaultPort = protocol === 'https' ? 443 : 80;
  const authority = port === defaultPort ? host : `${host}:${port}`;
  return `${protocol}://${authority}`;
}

export function resolveTcpEndpoint(options: ServiceEndpoint = {}): { host: string; port: number } {
  const host = options.host ?? env(ENV_KEYS.host) ?? env('STORAGE_HOST') ?? '127.0.0.1';
  const port = Number(
    options.port ?? env(ENV_KEYS.tcpPort) ?? env('STORAGE_TCP_PORT') ?? PORTS.tcp,
  );
  return { host, port };
}

export function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

export function fillPath(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (params[key] === undefined) throw new Error(`Missing path param: ${key}`);
    return encodeURIComponent(String(params[key]));
  });
}
