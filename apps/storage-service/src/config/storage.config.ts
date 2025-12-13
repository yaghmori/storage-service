import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageConfig {
  constructor(private configService: ConfigService) {}

  get defaultProvider(): string {
    return this.configService.get<string>('DEFAULT_STORAGE_PROVIDER') || 'local';
  }

  get maxFileSize(): number {
    return parseInt(
      this.configService.get<string>('MAX_FILE_SIZE') || '104857600',
      10,
    ); // 100MB default
  }

  get allowedMimeTypes(): string[] {
    const types = this.configService.get<string>('ALLOWED_MIME_TYPES');
    return types ? types.split(',') : [];
  }

  get uploadPath(): string {
    return this.configService.get<string>('UPLOAD_PATH') || './uploads';
  }
}

