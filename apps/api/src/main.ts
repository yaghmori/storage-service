import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { resolveListenPorts } from './config/listen-ports';

async function bootstrap() {
  const { httpHost, httpPort, tcpHost, tcpPort } = resolveListenPorts();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: tcpHost,
      port: tcpPort,
      retryAttempts: 5,
      retryDelay: 3000,
    },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort, httpHost);

  Logger.log(`HTTP server listening on http://${httpHost}:${httpPort}/${globalPrefix}`);
  Logger.log(`TCP microservice listening on ${tcpHost}:${tcpPort}`);
}

bootstrap();
