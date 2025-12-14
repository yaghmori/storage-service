import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisConfig {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  get host(): string {
    return this.configService.get<string>('REDIS_HOST') || 'localhost';
  }

  get port(): number {
    return parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10);
  }

  get password(): string | undefined {
    return this.configService.get<string>('REDIS_PASSWORD');
  }

  get db(): number {
    return parseInt(this.configService.get<string>('REDIS_DB') || '0', 10);
  }

  get connectionOptions() {
    return {
      host: this.host,
      port: this.port,
      ...(this.password && { password: this.password }),
      db: this.db,
    };
  }
}

