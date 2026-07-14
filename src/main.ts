import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SERVICE_PORTS } from '@yaghmori/messaging-contracts';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create HTTP application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Set global prefix
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Connect TCP microservice
  const tcpPort = parseInt(process.env.TCP_PORT || String(SERVICE_PORTS.STORAGE_SERVICE_TCP), 10);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: process.env.TCP_HOST || '0.0.0.0',
      port: tcpPort,
      retryAttempts: 5,
      retryDelay: 3000,
    },
  });

  // Start all microservices (exception filter will be applied via APP_FILTER provider)
  await app.startAllMicroservices();

  // Start HTTP server
  const httpPort = process.env.PORT || 4000;
  await app.listen(httpPort);

  Logger.log(`🚀 HTTP server is running on: http://localhost:${httpPort}/${globalPrefix}`);
  Logger.log(`🚀 TCP microservice is running on: ${process.env.TCP_HOST || '0.0.0.0'}:${tcpPort}`);
}

bootstrap();

