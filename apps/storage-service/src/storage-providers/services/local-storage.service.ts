import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';

@Injectable()
export class LocalStorageService {
  createInstance(config: any): IStorageProvider {
    const basePath = config.path || './uploads';

    // Ensure directory exists
    fs.mkdir(basePath, { recursive: true }).catch(() => {});

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
      delete: async (key: string) => {
        const filePath = join(basePath, key);
        await fs.unlink(filePath).catch(() => {});
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
      getSignedUrl: async (key: string) => {
        // For local storage, return a path that can be served
        return `/files/${key}`;
      },
      getPublicUrl: async (key: string) => {
        return `/files/${key}`;
      },
    };
  }
}

