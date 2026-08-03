import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService as AppConfigService } from './config.service';
import { DatabaseConfig } from './database.config';
import { ProcessorConfig } from './processor.config';
import { RedisConfig } from './redis.config';
import { StorageConfig } from './storage.config';

@Global()
@Module({
  // Import NestConfigModule to ensure ConfigService is available
  // Even though it's global, importing it here ensures proper initialization order
  imports: [NestConfigModule],
  providers: [
    AppConfigService,
    DatabaseConfig,
    RedisConfig,
    StorageConfig,
    ProcessorConfig,
  ],
  exports: [
    AppConfigService,
    DatabaseConfig,
    RedisConfig,
    StorageConfig,
    ProcessorConfig,
  ],
})
export class ConfigModule {}

