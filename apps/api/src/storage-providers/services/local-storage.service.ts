import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';
import { LocalConfig } from '../types/storage-provider-config.types';

@Injectable()
export class LocalStorageService {
  createInstance(config: LocalConfig): IStorageProvider {
    const basePath = config.path || './uploads';

    // Ensure directory exists
    fs.mkdir(basePath, { recursive: true }).catch((error) => {
      console.error(`Error creating directory ${basePath}:`, error);
    });

    return {
      upload: async (key: string, buffer: Buffer) => {
        const filePath = join(basePath, key);
        const dir = join(filePath, '..');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, buffer);
        return key;
      },
      download: async (key: string) => {
        const filePath = join(basePath, key);
        return fs.readFile(filePath);
      },
      downloadToFile: async (key: string, destPath: string) => {
        const { createReadStream, createWriteStream } = await import('fs');
        const { pipeline } = await import('stream/promises');
        const filePath = join(basePath, key);
        await pipeline(createReadStream(filePath), createWriteStream(destPath));
      },
      openReadStream: async (key: string) => {
        const { createReadStream } = await import('fs');
        return createReadStream(join(basePath, key));
      },
      delete: async (key: string) => {
        const filePath = join(basePath, key);
        await fs.unlink(filePath).catch((error) => {
          console.error(`Error deleting file ${filePath}:`, error);
        });
      },
      exists: async (key: string) => {
        const filePath = join(basePath, key);
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      },
      stat: async (key: string) => {
        const filePath = join(basePath, key);
        const info = await fs.stat(filePath);
        return { size: info.size };
      },
      getSignedUrl: async (key: string) => {
        // For local storage, return a path that can be served
        return `/files/${key}`;
      },
      getPublicUrl: async (key: string) => {
        return `/files/${key}`;
      },
      // Direct/presigned uploads are not supported for local disk — use POST /upload.
    };
  }
}

