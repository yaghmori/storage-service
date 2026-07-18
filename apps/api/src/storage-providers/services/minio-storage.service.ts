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

@Injectable()
export class MinIOStorageService {
  private readonly logger = new Logger(MinIOStorageService.name);

  async createInstance(config: MinIOConfig): Promise<IStorageProvider> {
    const { endPoint, port, useSSL } = resolveMinioEndpoint(config);

    if (!config.accessKeyId?.trim() || !config.secretAccessKey?.trim()) {
      throw new Error('MinIO accessKeyId and secretAccessKey are required');
    }

    const client = new MinIO.Client({
      endPoint,
      port,
      useSSL,
      accessKey: config.accessKeyId,
      secretKey: config.secretAccessKey,
    });

    const bucketName = config.bucket;
    if (bucketName) {
      try {
        const exists = await client.bucketExists(bucketName);
        if (!exists) {
          await client.makeBucket(bucketName, config.region || 'us-east-1');
          this.logger.log(
            `Created MinIO bucket "${bucketName}" on ${endPoint}:${port}`,
          );
        }
      } catch (error) {
        const hint = isLoopbackHost(endPoint)
          ? ' If the API runs in Docker, set provider endpoint (or MINIO_ENDPOINT) to the MinIO service hostname (e.g. "minio"), not localhost.'
          : '';
        throw new Error(
          `Failed to check/create MinIO bucket "${bucketName}" at ${useSSL ? 'https' : 'http'}://${endPoint}:${port}: ${formatMinioError(error)}.${hint}`,
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
        return client.presignedGetObject(config.bucket, key, expiresIn);
      },
      getPublicUrl: async (key: string) => {
        const protocol = useSSL ? 'https' : 'http';
        return `${protocol}://${endPoint}:${port}/${config.bucket}/${key}`;
      },
    };
  }
}
