export interface S3Config {
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export interface MinIOConfig {
  bucket: string;
  endpoint?: string;
  port?: number | string;
  useSSL?: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface LocalConfig {
  bucket?: string;
  path?: string;
}

export type StorageProviderConfig = S3Config | MinIOConfig | LocalConfig;

export type StorageProviderType = 's3' | 'minio' | 'local';

export interface StorageProvider {
  id: string;
  name: string;
  type: StorageProviderType;
  config: StorageProviderConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
