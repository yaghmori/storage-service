import type { Readable } from 'stream';

export interface IStorageProvider {
  upload(key: string, buffer: Buffer, contentType?: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  /** Stream object bytes to a local file without buffering the whole object in RAM. */
  downloadToFile(key: string, destPath: string): Promise<void>;
  /** Open a readable stream for the object (for HTTP serving without Buffer.concat). */
  openReadStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): Promise<string>;
}

export interface StorageProviderConfig {
  type: 's3' | 'minio' | 'local';
  name: string;
  config: {
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
    region?: string;
    useSSL?: boolean;
    path?: string;
  };
  isActive: boolean;
}
