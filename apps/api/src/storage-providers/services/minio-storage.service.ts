import { Injectable, Logger } from '@nestjs/common';
import * as MinIO from 'minio';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';
import { MinIOConfig } from '../types/storage-provider-config.types';

type ResolvedMinioEndpoint = {
  endPoint: string;
  port: number;
  useSSL: boolean;
};

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '[::1]'
  );
}

function formatMinioError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = [record.code, record.message, record.name].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    );
    if (parts.length > 0) {
      return parts.join(' — ');
    }
  }
  return String(error);
}

/** Accepts hostname, host:port, or full URL (http://host:9000). */
function parseMinioEndpoint(
  rawEndpoint: string | undefined,
  rawPort: number | string | undefined,
  rawUseSSL: boolean | undefined,
): ResolvedMinioEndpoint {
  let endPoint = 'localhost';
  let port =
    rawPort != null && String(rawPort).trim() !== ''
      ? parseInt(String(rawPort), 10)
      : 9000;
  let useSSL = Boolean(rawUseSSL);

  const trimmed = rawEndpoint?.trim() || '';
  if (!trimmed) {
    return {
      endPoint,
      port: Number.isFinite(port) ? port : 9000,
      useSSL,
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    endPoint = url.hostname;
    if (url.port) {
      port = parseInt(url.port, 10);
    } else {
      port = url.protocol === 'https:' ? 443 : 80;
    }
    useSSL = url.protocol === 'https:' || useSSL;
  } else {
    const withoutPath = trimmed.split('/')[0] || trimmed;
    if (withoutPath.startsWith('[')) {
      const match = withoutPath.match(/^\[([^\]]+)\](?::(\d+))?$/);
      endPoint = match?.[1] || withoutPath;
      if (match?.[2]) {
        port = parseInt(match[2], 10);
      }
    } else {
      const hostPort = withoutPath.split(':');
      endPoint = hostPort[0] || withoutPath;
      if (hostPort.length === 2 && hostPort[1] && /^\d+$/.test(hostPort[1])) {
        port = parseInt(hostPort[1], 10);
      }
    }
  }

  return {
    endPoint: endPoint.replace(/^\[|\]$/g, ''),
    port: Number.isFinite(port) && port > 0 ? port : 9000,
    useSSL,
  };
}

/**
 * Provider rows are often seeded from host `.env` (localhost). When the API
 * runs in Docker, compose sets MINIO_ENDPOINT=minio — prefer that over loopback.
 */
function resolveMinioEndpoint(config: MinIOConfig): ResolvedMinioEndpoint {
  const fromConfig = parseMinioEndpoint(config.endpoint, config.port, config.useSSL);
  const envEndpoint = process.env.MINIO_ENDPOINT?.trim();
  if (!envEndpoint || !isLoopbackHost(fromConfig.endPoint)) {
    return fromConfig;
  }

  const fromEnv = parseMinioEndpoint(
    envEndpoint,
    process.env.MINIO_PORT || config.port,
    process.env.MINIO_USE_SSL === 'true' || config.useSSL,
  );

  if (!isLoopbackHost(fromEnv.endPoint)) {
    return fromEnv;
  }

  return fromConfig;
}

/**
 * Host used in browser-facing signed URLs. Prefer provider `publicEndpoint`,
 * then MINIO_PUBLIC_ENDPOINT. Never return a Docker-only hostname (e.g. "minio")
 * — browsers cannot resolve Compose service DNS.
 */
function isLikelyDockerServiceHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized || isLoopbackHost(normalized)) return false;
  // Compose DNS names are single labels without dots ("minio", "storage-minio").
  return !normalized.includes('.');
}

function resolvePublicMinioEndpoint(
  config: MinIOConfig,
  internal: ResolvedMinioEndpoint,
): ResolvedMinioEndpoint {
  const fromConfig = config.publicEndpoint?.trim();
  if (fromConfig) {
    const parsed = parseMinioEndpoint(fromConfig, undefined, config.useSSL);
    if (!isLikelyDockerServiceHost(parsed.endPoint)) {
      return parsed;
    }
  }

  const fromEnv = process.env.MINIO_PUBLIC_ENDPOINT?.trim();
  if (fromEnv) {
    return parseMinioEndpoint(
      fromEnv,
      process.env.MINIO_PUBLIC_PORT,
      process.env.MINIO_PUBLIC_USE_SSL === 'true' || config.useSSL,
    );
  }

  // Internal API host is Docker DNS — fall back to localhost for browser URLs.
  if (isLikelyDockerServiceHost(internal.endPoint)) {
    const port =
      process.env.MINIO_PUBLIC_PORT?.trim() ||
      String(internal.port || 9000);
    return parseMinioEndpoint(`http://localhost:${port}`, port, false);
  }

  return internal;
}

function rewriteSignedUrlEndpoint(
  url: string,
  from: ResolvedMinioEndpoint,
  to: ResolvedMinioEndpoint,
): string {
  if (sameEndpoint(from, to)) return url;
  try {
    const parsed = new URL(url);
    const fromHost = from.endPoint.toLowerCase();
    if (parsed.hostname.toLowerCase() !== fromHost) return url;
    parsed.protocol = to.useSSL ? 'https:' : 'http:';
    parsed.hostname = to.endPoint;
    parsed.port = String(to.port);
    return parsed.toString();
  } catch {
    return url;
  }
}

function sameEndpoint(a: ResolvedMinioEndpoint, b: ResolvedMinioEndpoint): boolean {
  return a.endPoint === b.endPoint && a.port === b.port && a.useSSL === b.useSSL;
}

@Injectable()
export class MinIOStorageService {
  private readonly logger = new Logger(MinIOStorageService.name);

  async createInstance(config: MinIOConfig): Promise<IStorageProvider> {
    const internal = resolveMinioEndpoint(config);
    const publicEp = resolvePublicMinioEndpoint(config, internal);

    if (!config.accessKeyId?.trim() || !config.secretAccessKey?.trim()) {
      throw new Error('MinIO accessKeyId and secretAccessKey are required');
    }

    // Region must be set so presign does not call GetBucketLocation against
    // publicEndpoint (localhost/CDN is unreachable from inside Docker).
    const region = config.region?.trim() || 'us-east-1';

    const client = new MinIO.Client({
      endPoint: internal.endPoint,
      port: internal.port,
      useSSL: internal.useSSL,
      accessKey: config.accessKeyId,
      secretKey: config.secretAccessKey,
      region,
    });

    const signingClient = sameEndpoint(internal, publicEp)
      ? client
      : new MinIO.Client({
          endPoint: publicEp.endPoint,
          port: publicEp.port,
          useSSL: publicEp.useSSL,
          accessKey: config.accessKeyId,
          secretKey: config.secretAccessKey,
          region,
        });

    if (!sameEndpoint(internal, publicEp)) {
      this.logger.log(
        `MinIO signed URLs use public endpoint ${publicEp.useSSL ? 'https' : 'http'}://${publicEp.endPoint}:${publicEp.port} (API uses ${internal.endPoint}:${internal.port})`,
      );
    }

    const bucketName = config.bucket;
    if (bucketName) {
      try {
        const exists = await client.bucketExists(bucketName);
        if (!exists) {
          await client.makeBucket(bucketName, config.region || 'us-east-1');
          this.logger.log(
            `Created MinIO bucket "${bucketName}" on ${internal.endPoint}:${internal.port}`,
          );
        }
      } catch (error) {
        const hint = isLoopbackHost(internal.endPoint)
          ? ' If the API runs in Docker, set provider endpoint (or MINIO_ENDPOINT) to the MinIO service hostname (e.g. "minio"), not localhost.'
          : '';
        throw new Error(
          `Failed to check/create MinIO bucket "${bucketName}" at ${internal.useSSL ? 'https' : 'http'}://${internal.endPoint}:${internal.port}: ${formatMinioError(error)}.${hint}`,
        );
      }
    }

    return {
      upload: async (key: string, buffer: Buffer, contentType?: string) => {
        await client.putObject(config.bucket, key, buffer, buffer.length, {
          'Content-Type': contentType || 'application/octet-stream',
        });
        return key;
      },
      download: async (key: string) => {
        const stream = await client.getObject(config.bucket, key);
        const chunks: Buffer[] = [];
        return new Promise<Buffer>((resolve, reject) => {
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });
      },
      delete: async (key: string) => {
        await client.removeObject(config.bucket, key);
      },
      exists: async (key: string) => {
        try {
          await client.statObject(config.bucket, key);
          return true;
        } catch {
          return false;
        }
      },
      getSignedUrl: async (key: string, expiresIn = 3600) => {
        const url = await signingClient.presignedGetObject(
          config.bucket,
          key,
          expiresIn,
        );
        // Belt-and-suspenders: rewrite if MinIO still stamped the API host.
        return rewriteSignedUrlEndpoint(url, internal, publicEp);
      },
      getPublicUrl: async (key: string) => {
        const protocol = publicEp.useSSL ? 'https' : 'http';
        return `${protocol}://${publicEp.endPoint}:${publicEp.port}/${config.bucket}/${key}`;
      },
    };
  }
}
