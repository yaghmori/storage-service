import type { Readable } from 'stream';

export type MultipartCompletedPart = {
  partNumber: number;
  etag: string;
};

export type ObjectStat = {
  size: number;
  etag?: string;
  contentType?: string;
};

export interface IStorageProvider {
  upload(key: string, buffer: Buffer, contentType?: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  /** Stream object bytes to a local file without buffering the whole object in RAM. */
  downloadToFile(key: string, destPath: string): Promise<void>;
  /** Open a readable stream for the object (for HTTP serving without Buffer.concat). */
  openReadStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Object metadata (size/etag) when supported by the backend. */
  stat?(key: string): Promise<ObjectStat>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): Promise<string>;

  /** Presigned PUT for direct client → object-store uploads (MinIO/S3). */
  getSignedUploadUrl?(
    key: string,
    expiresIn?: number,
    contentType?: string,
  ): Promise<string>;
  createMultipartUpload?(
    key: string,
    contentType?: string,
  ): Promise<{ uploadId: string }>;
  getSignedUploadPartUrl?(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn?: number,
  ): Promise<string>;
  completeMultipartUpload?(
    key: string,
    uploadId: string,
    parts: MultipartCompletedPart[],
  ): Promise<void>;
  abortMultipartUpload?(key: string, uploadId: string): Promise<void>;
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
