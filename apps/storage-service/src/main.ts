import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { TcpExceptionFilter } from './common/filters/tcp-exception.filter';

async function bootstrap() {
  // Create HTTP application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Set global prefix
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Connect TCP microservice
  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: process.env.TCP_HOST || '0.0.0.0',
      port: parseInt(process.env.TCP_PORT || '4001', 10),
      retryAttempts: 5,
      retryDelay: 3000,
    },
  });

  // Apply exception filter to microservice
  microservice.useGlobalFilters(new TcpExceptionFilter());

  // Start all microservices
  await app.startAllMicroservices();

  // Start HTTP server
  const httpPort = process.env.PORT || 4000;
  await app.listen(httpPort);

  Logger.log(`🚀 HTTP server is running on: http://localhost:${httpPort}/${globalPrefix}`);
  Logger.log(`🚀 TCP microservice is running on: ${process.env.TCP_HOST || '0.0.0.0'}:${parseInt(process.env.TCP_PORT || '4001', 10)}`);
}

bootstrap();

