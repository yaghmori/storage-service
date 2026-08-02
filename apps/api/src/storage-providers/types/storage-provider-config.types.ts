export interface S3Config {
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  /** Browser/CDN base for public URLs (optional). */
  publicEndpoint?: string;
  forcePathStyle?: boolean;
  /** Default signed URL TTL in seconds when caller omits expiresIn. */
  signedUrlExpiresIn?: number;
}

export interface MinIOConfig {
  bucket: string;
  endpoint?: string;
  /**
   * Browser-facing base URL for signed/public URLs
   * (e.g. http://localhost:9000 or https://cdn.allyfe.org).
   * Keep `endpoint` as the API→MinIO host (e.g. minio).
   */
  publicEndpoint?: string;
  port?: number | string;
  useSSL?: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  /** Default signed URL TTL in seconds when caller omits expiresIn. */
  signedUrlExpiresIn?: number;
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
