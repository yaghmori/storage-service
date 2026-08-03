import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';
import { S3Config } from '../types/storage-provider-config.types';

@Injectable()
export class S3StorageService {
  createInstance(config: S3Config): IStorageProvider {
    const client = new S3Client({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle || false,
    });

    return {
      upload: async (key: string, buffer: Buffer, contentType?: string) => {
        const command = new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        });
        await client.send(command);
        return key;
      },
      download: async (key: string) => {
        const command = new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        });
        const response = await client.send(command);
        const chunks: Uint8Array[] = [];
        if (response.Body) {
          const stream = response.Body as Readable;
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
        }
        return Buffer.concat(chunks);
      },
      downloadToFile: async (key: string, destPath: string) => {
        const { createWriteStream } = await import('fs');
        const { pipeline } = await import('stream/promises');
        const command = new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        });
        const response = await client.send(command);
        if (!response.Body) {
          throw new Error(`S3 object "${key}" has empty body`);
        }
        await pipeline(response.Body as Readable, createWriteStream(destPath));
      },
      openReadStream: async (key: string) => {
        const command = new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        });
        const response = await client.send(command);
        if (!response.Body) {
          throw new Error(`S3 object "${key}" has empty body`);
        }
        return response.Body as Readable;
      },
      delete: async (key: string) => {
        const command = new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        });
        await client.send(command);
      },
      exists: async (key: string) => {
        try {
          const command = new HeadObjectCommand({
            Bucket: config.bucket,
            Key: key,
          });
          await client.send(command);
          return true;
        } catch {
          return false;
        }
      },
      getSignedUrl: async (key: string, expiresIn = 3600) => {
        const command = new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        });
        return getSignedUrl(client, command, { expiresIn });
      },
      getPublicUrl: async (key: string) => {
        if (config.publicEndpoint?.trim()) {
          return `${config.publicEndpoint.replace(/\/$/, '')}/${config.bucket}/${key}`;
        }
        if (config.endpoint) {
          return `${config.endpoint.replace(/\/$/, '')}/${config.bucket}/${key}`;
        }
        return `https://${config.bucket}.s3.${config.region || 'us-east-1'}.amazonaws.com/${key}`;
      },
    };
  }
}

