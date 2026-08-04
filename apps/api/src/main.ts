import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { appRole } from './config/app-role';
import { resolveListenPorts } from './config/listen-ports';

async function bootstrap() {
  const { httpHost, httpPort, tcpHost, tcpPort } = resolveListenPorts();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
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
}

bootstrap();
