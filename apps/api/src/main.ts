import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { appRole } from './config/app-role';
import { resolveListenPorts } from './config/listen-ports';
import { isRetriableKafkaError } from './lib/platform-kafka/kafka-js-logger';

async function bootstrap() {
  const { httpHost, httpPort, tcpHost, tcpPort } = resolveListenPorts();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const httpAdapter = app.getHttpAdapter();
  if (httpAdapter?.getInstance) {
    const instance = httpAdapter.getInstance();
    if (typeof instance?.set === 'function') {
      instance.set('trust proxy', 1);
    }
  }

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const logger = app.get(Logger);

  if (appRole.enableTcp) {
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
    logger.log(`TCP microservice listening on ${tcpHost}:${tcpPort}`);
  }

  if (appRole.enableHttp) {
    await app.listen(httpPort, httpHost);
    logger.log(`HTTP server listening on http://${httpHost}:${httpPort}`);
  } else {
    await app.init();
    logger.log(
      `HTTP disabled (ENABLE_HTTP=false); workers=${appRole.enableWorkers} crons=${appRole.enableCrons}`,
    );
  }

  logger.log(
    `Role flags: HTTP=${appRole.enableHttp} TCP=${appRole.enableTcp} WORKERS=${appRole.enableWorkers} CRONS=${appRole.enableCrons}`,
  );

  const gracefulShutdown = async (signal: string) => {
    logger.log(`Received ${signal}, starting graceful shutdown...`);
    try {
      await app.close();
      logger.log('Application closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error({ msg: 'graceful_shutdown_error', err: error });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logger.error({ msg: 'uncaught_exception', err: error });
    gracefulShutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    if (isRetriableKafkaError(reason)) {
      const message = reason instanceof Error ? reason.message : String(reason);
      logger.warn({ msg: 'ignored_retriable_kafka_rejection', error: message });
      return;
    }
    logger.error({ msg: 'unhandled_rejection', err: reason });
    gracefulShutdown('unhandledRejection');
  });
}

bootstrap();
