import { Module } from '@nestjs/common';
import { KafkaModule } from '../lib/platform-kafka';
import Redis from 'ioredis';
import { ConfigModule } from '../config/config.module';
import { RedisConfig } from '../config/redis.config';

@Module({
  imports: [
    ConfigModule,
    // Use KafkaModule with async Redis factory for idempotency support
    // If Redis is not available, idempotency will use NoOp service (graceful degradation)
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
          // Redis not available - idempotency will use NoOp service
          return undefined;
        }
      },
      inject: [RedisConfig],
    }),
  ],
  // EventPublisherService is now provided by KafkaModule
  exports: [],
})
export class EventsModule {}
