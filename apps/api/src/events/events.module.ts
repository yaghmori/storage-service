import { Module } from '@nestjs/common';
import { KafkaModule } from '../lib/platform-kafka';
import Redis from 'ioredis';
import { ConfigModule } from '../config/config.module';
import { RedisConfig } from '../config/redis.config';

@Module({
  imports: [
    ConfigModule,
    KafkaModule.forRootAsync({
      redisFactory: async (redisConfig: RedisConfig) => {
        try {
          return new Redis({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
          });
        } catch {
          return undefined;
        }
      },
      inject: [RedisConfig],
    }),
  ],
  exports: [KafkaModule],
})
export class EventsModule {}
