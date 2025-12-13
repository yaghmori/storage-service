import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { DatabaseConfig } from './database.config';
import { RedisConfig } from './redis.config';
import { StorageConfig } from './storage.config';

@Module({
  providers: [ConfigService, DatabaseConfig, RedisConfig, StorageConfig],
  exports: [ConfigService, DatabaseConfig, RedisConfig, StorageConfig],
})
export class ConfigModule {}

