import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';

@Injectable()
export class S3StorageService {
  createInstance(config: any): IStorageProvider {
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
          for await (const chunk of response.Body as any) {
            chunks.push(chunk);
          }
        }
        return Buffer.concat(chunks);
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
      getSignedUrl: async (key: string, expiresIn: number = 3600) => {
        const command = new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        });
        return getSignedUrl(client, command, { expiresIn });
      },
      getPublicUrl: async (key: string) => {
        if (config.endpoint) {
          return `${config.endpoint}/${config.bucket}/${key}`;
        }
        return `https://${config.bucket}.s3.${config.region || 'us-east-1'}.amazonaws.com/${key}`;
      },
    };
  }
}

