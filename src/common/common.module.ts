import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import {
  GlobalExceptionFilter,
  MicroserviceExceptionFilter,
  ResponseTransformInterceptor,
} from '@platform/messaging-contracts';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ValidationPipe } from './pipes/validation.pipe';

@Global()
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter, // HTTP requests only
    },
    {
      provide: APP_FILTER,
      useClass: MicroserviceExceptionFilter, // TCP/RPC MessagePattern handlers only
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
  exports: [],
})
export class CommonModule {}

