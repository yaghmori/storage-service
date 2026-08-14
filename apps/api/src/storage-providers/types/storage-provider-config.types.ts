export interface S3Config {
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  /** Optional unsigned public/CDN base (not used for app-signed delivery). */
  publicEndpoint?: string;
  forcePathStyle?: boolean;
  /** Default signed URL TTL in seconds when caller omits expiresIn. */
  signedUrlExpiresIn?: number;
}

export interface MinIOConfig {
  bucket: string;
  endpoint?: string;
  /**
   * @deprecated Not used for delivery. App-signed URLs go to FILES_PUBLIC_BASE_URL.
   */
  publicEndpoint?: string;
  /**
   * Optional public S3 API for this MinIO (HTTPS hostname browsers can reach).
   * Leave empty for private Docker MinIO — delivery streams through the API.
   */
  browserEndpoint?: string;
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
