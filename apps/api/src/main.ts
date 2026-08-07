import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { appRole } from './config/app-role';
import { resolveListenPorts } from './config/listen-ports';
import { isRetriableKafkaError } from './lib/platform-kafka/kafka-js-logger';

async function bootstrap() {
  const { httpHost, httpPort, tcpHost, tcpPort } = resolveListenPorts();

  const nestLogLevels = (process.env.LOG_LEVEL || 'log').toLowerCase();
  const loggerLevels =
    nestLogLevels === 'error'
      ? (['error'] as const)
      : nestLogLevels === 'warn'
        ? (['error', 'warn'] as const)
        : nestLogLevels === 'debug' || nestLogLevels === 'verbose'
          ? (['error', 'warn', 'log', 'debug', 'verbose'] as const)
          : (['error', 'warn', 'log'] as const);

  const app = await NestFactory.create(AppModule, {
    logger: [...loggerLevels],
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

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
    Logger.log(`TCP microservice listening on ${tcpHost}:${tcpPort}`);
  }

  if (appRole.enableHttp) {
    await app.listen(httpPort, httpHost);
    Logger.log(
      `HTTP server listening on http://${httpHost}:${httpPort}/${globalPrefix}`,
    );
  } else {
    await app.init();
    Logger.log(
      `HTTP disabled (ENABLE_HTTP=false); workers=${appRole.enableWorkers} crons=${appRole.enableCrons}`,
    );
  }

  Logger.log(
    `Role flags: HTTP=${appRole.enableHttp} TCP=${appRole.enableTcp} WORKERS=${appRole.enableWorkers} CRONS=${appRole.enableCrons}`,
  );

  const gracefulShutdown = async (signal: string) => {
    Logger.log(`Received ${signal}, starting graceful shutdown...`);
    try {
      await app.close();
      Logger.log('Application closed successfully');
      process.exit(0);
    } catch (error) {
      Logger.error('Error during graceful shutdown', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception', error);
    gracefulShutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    if (isRetriableKafkaError(reason)) {
      const message = reason instanceof Error ? reason.message : String(reason);
      Logger.warn(`Ignored retriable Kafka rejection: ${message}`);
      return;
    }
    Logger.error('Unhandled rejection', reason);
    gracefulShutdown('unhandledRejection');
  });
}

bootstrap();
