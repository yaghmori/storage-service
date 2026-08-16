import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Default multipart form / Multer ceiling (100 MiB). */
const DEFAULT_MAX_FILE_SIZE = 104_857_600;
/** Default direct-to-object-store ceiling (5 GiB). */
const DEFAULT_DIRECT_UPLOAD_MAX = 5_368_709_120;
/** Default signed upload URL TTL. */
const DEFAULT_UPLOAD_URL_EXPIRES = 3600;
/** Default multipart part size (16 MiB). */
const DEFAULT_MULTIPART_PART_SIZE = 16_777_216;
/** Use multipart when declared size exceeds this (100 MiB). */
const DEFAULT_MULTIPART_THRESHOLD = 104_857_600;

@Injectable()
export class StorageConfig {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  get defaultProvider(): string {
    return this.configService.get<string>('DEFAULT_STORAGE_PROVIDER') || 'local';
  }

  /** Platform ceiling for proxy multipart uploads (Multer / POST /upload). */
  get maxFileSize(): number {
    return this.parsePositiveInt(
      this.configService.get<string>('MAX_FILE_SIZE'),
      DEFAULT_MAX_FILE_SIZE,
    );
  }

  /**
   * Ceiling for direct/presigned uploads (initiate → object store → complete).
   * May exceed MAX_FILE_SIZE so large files skip Nest RAM.
   */
  get directUploadMaxFileSize(): number {
    return this.parsePositiveInt(
      this.configService.get<string>('DIRECT_UPLOAD_MAX_FILE_SIZE'),
      DEFAULT_DIRECT_UPLOAD_MAX,
    );
  }

  get uploadUrlExpiresIn(): number {
    return this.parsePositiveInt(
      this.configService.get<string>('UPLOAD_URL_EXPIRES_IN'),
      DEFAULT_UPLOAD_URL_EXPIRES,
    );
  }

  get multipartPartSize(): number {
    return this.parsePositiveInt(
      this.configService.get<string>('MULTIPART_PART_SIZE'),
      DEFAULT_MULTIPART_PART_SIZE,
    );
  }

  get multipartThreshold(): number {
    return this.parsePositiveInt(
      this.configService.get<string>('MULTIPART_THRESHOLD'),
      DEFAULT_MULTIPART_THRESHOLD,
    );
  }

  get allowedMimeTypes(): string[] {
    const types = this.configService.get<string>('ALLOWED_MIME_TYPES');
    return types ? types.split(',') : [];
  }

  get uploadPath(): string {
    return this.configService.get<string>('UPLOAD_PATH') || './uploads';
  }

  /** Public origin for app-signed download URLs (e.g. https://cdn.allyfe.org). */
  get filesPublicBaseUrl(): string {
    const raw =
      this.configService.get<string>('FILES_PUBLIC_BASE_URL') ||
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('BASE_URL') ||
      '';
    return raw.replace(/\/$/, '');
  }

  get filesSigningSecret(): string {
    const secret =
      this.configService.get<string>('FILES_SIGNING_SECRET')?.trim() ||
      this.configService.get<string>('JWT_SECRET')?.trim() ||
      '';
    return secret;
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = parseInt(raw || String(fallback), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
