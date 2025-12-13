import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfig {
  constructor(private configService: ConfigService) {}

  get connectionString(): string {
    return (
      this.configService.get<string>('DATABASE_URL') ||
      'postgresql://postgres:postgres@localhost:5432/storage_service'
    );
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

