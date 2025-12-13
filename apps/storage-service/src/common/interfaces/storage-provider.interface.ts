export interface IStorageProvider {
  upload(key: string, buffer: Buffer, contentType?: string): Promise<string>;
  download(key: string): Promise<Buffer>;
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

