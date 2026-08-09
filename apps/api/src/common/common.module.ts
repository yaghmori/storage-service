import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import {
  GlobalExceptionFilter,
  MicroserviceExceptionFilter,
  ResponseTransformInterceptor,
} from '../lib/contracts';
import { DatabaseModule } from '../database/database.module';
import { AuthGuard } from './guards/auth.guard';
import { UploadRateLimitGuard } from './guards/upload-rate-limit.guard';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ValidationPipe } from './pipes/validation.pipe';
import { ApiKeyService } from './services/api-key.service';
import { buildLoggerModuleParams } from './logging/pino-logger.config';

@Global()
@Module({
  imports: [
    LoggerModule.forRoot(buildLoggerModuleParams()),
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttl = parseInt(config.get<string>('RATE_LIMIT_TTL_MS') || '60000', 10);
        const limit = parseInt(config.get<string>('RATE_LIMIT_MAX') || '120', 10);
        return [
          {
            name: 'default',
            ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : 60_000,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 120,
          },
        ];
      },
    }),
  ],
  providers: [
    ApiKeyService,
    AuthGuard,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: UploadRateLimitGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: MicroserviceExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    Reflector,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
  exports: [AuthGuard, ApiKeyService],
})
export class CommonModule {}
