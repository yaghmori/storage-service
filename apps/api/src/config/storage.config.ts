import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageConfig {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  get defaultProvider(): string {
    return this.configService.get<string>('DEFAULT_STORAGE_PROVIDER') || 'local';
  }

  get maxFileSize(): number {
    return parseInt(
      this.configService.get<string>('MAX_FILE_SIZE') || '524288000',
      10,
    ); // 500MB default (safe with stream-to-disk video / integrity I/O)
  }

  get allowedMimeTypes(): string[] {
    const types = this.configService.get<string>('ALLOWED_MIME_TYPES');
    return types ? types.split(',') : [];
  }

  get uploadPath(): string {
    return this.configService.get<string>('UPLOAD_PATH') || './uploads';
  }
}

