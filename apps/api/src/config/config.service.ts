import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {}

  get<T = unknown>(key: string): T {
    return this.nestConfigService.get<T>(key) as T;
  }
}

