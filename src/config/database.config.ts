import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfig {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  get connectionString(): string {
    const url = this.configService.get<string>('DATABASE_URL') ||
      'postgresql://postgres:postgres@localhost:5432/storage_service';

    // Ensure SSL is disabled for local development if not already specified
    if (!url.includes('sslmode=')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}sslmode=disable`;
    }

    return url;
  }

  get host(): string {
    return this.configService.get<string>('DB_HOST') || 'localhost';
  }

  get port(): number {
    return parseInt(this.configService.get<string>('DB_PORT') || '5432', 10);
  }

  get database(): string {
    return this.configService.get<string>('DB_NAME') || 'storage_service';
  }

  get username(): string {
    return this.configService.get<string>('DB_USER') || 'postgres';
  }

  get password(): string {
    return this.configService.get<string>('DB_PASSWORD') || 'postgres';
  }
}

