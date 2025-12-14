import { Injectable } from '@nestjs/common';
import * as MinIO from 'minio';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';
import { MinIOConfig } from '../types/storage-provider-config.types';

@Injectable()
export class MinIOStorageService {
  async createInstance(config: MinIOConfig): Promise<IStorageProvider> {
    const client = new MinIO.Client({
      endPoint: config.endpoint?.replace('http://', '').replace('https://', '') || 'localhost',
      port: config.port ? parseInt((config.port as string), 10) : 9000,
      useSSL: config.useSSL || false,
      accessKey: config.accessKeyId,
      secretKey: config.secretAccessKey,
    });

    // Ensure bucket exists, create if it doesn't
    const bucketName = config.bucket;
    if (bucketName) {
      try {
        const exists = await client.bucketExists(bucketName);
        if (!exists) {
          await client.makeBucket(bucketName, 'us-east-1');
        }
      } catch (error) {
        throw new Error(
          `Failed to check/create MinIO bucket "${bucketName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        const protocol = config.useSSL ? 'https' : 'http';
        const endpoint = config.endpoint?.replace('http://', '').replace('https://', '') || 'localhost';
        const port = config.port ? `:${config.port}` : '';
        return `${protocol}://${endpoint}${port}/${config.bucket}/${key}`;
      },
    };
  }
}

