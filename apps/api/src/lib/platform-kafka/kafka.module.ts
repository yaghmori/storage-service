// Kafka module for NestJS dependency injection
// Provides all Kafka-related services as singletons

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import { DLQService } from './dlq.service';
import { EventPublisherService } from './event-publisher.service';
import { IdempotencyService, IIdempotencyService, NoOpIdempotencyService } from './idempotency.service';
import { KafkaClientFactory } from './kafka-client-factory';
import { KafkaTopicInitializerService } from './kafka-topic-initializer.service';
import { StorageLifecycleEventsService } from './storage-lifecycle-events.service';

export interface KafkaModuleOptions {
  /** Optional Redis instance for idempotency service */
  redis?: Redis;
  /** Optional custom idempotency service implementation */
  idempotencyService?: IIdempotencyService;
}

export interface KafkaModuleAsyncOptions {
  /** Optional factory function to create Redis instance asynchronously */
  redisFactory?: (...args: any[]) => Promise<Redis | undefined> | Redis | undefined;
  /** Optional dependencies to inject into redisFactory */
  inject?: any[];
  /** Optional custom idempotency service implementation */
  idempotencyService?: IIdempotencyService;
}

/**
 * Kafka module that provides all Kafka-related services.
 *
 * Provides:
 * - KafkaClientFactory (singleton)
 * - EventPublisherService (uses factory)
 * - IdempotencyService (optional, can be overridden)
 * - DLQService (optional)
 *
 * Usage:
 * ```typescript
 * @Module({
 *   imports: [KafkaModule.forRoot()],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class KafkaModule {
  /**
   * Synchronous configuration for KafkaModule.
   * Use this when you have Redis instance available synchronously.
   */
  static forRoot(options?: KafkaModuleOptions): DynamicModule {
    return {
      module: KafkaModule,
      imports: [ConfigModule],
      providers: [
        KafkaClientFactory,
        {
          provide: 'REDIS_FOR_IDEMPOTENCY',
          useValue: options?.redis,
        },
        {
          provide: IdempotencyService,
          useFactory: (redis?: Redis, customService?: IIdempotencyService) => {
            if (customService) {
              return customService;
            }
            if (redis) {
              return new IdempotencyService(redis);
            }
            return new NoOpIdempotencyService();
          },
          inject: ['REDIS_FOR_IDEMPOTENCY', { token: 'IDEMPOTENCY_SERVICE', optional: true }],
        },
        {
          provide: 'IDEMPOTENCY_SERVICE',
          useValue: options?.idempotencyService,
        },
        {
          provide: DLQService,
          useFactory: async (factory: KafkaClientFactory) => {
            try {
              if (!process.env.KAFKA_BROKERS) {
                return null;
              }
              const client = await factory.getKafkaClient();
              return new DLQService(client);
            } catch {
              return null;
            }
          },
          inject: [KafkaClientFactory],
        },
        EventPublisherService,
        StorageLifecycleEventsService,
        KafkaTopicInitializerService,
      ],
      exports: [
        KafkaClientFactory,
        EventPublisherService,
        StorageLifecycleEventsService,
        IdempotencyService,
        DLQService,
        KafkaTopicInitializerService,
      ],
    };
  }

  /**
   * Asynchronous configuration for KafkaModule.
   * Use this when you need to create Redis instance asynchronously (e.g., from ConfigService).
   */
  static forRootAsync(options: KafkaModuleAsyncOptions): DynamicModule {
    return {
      module: KafkaModule,
      imports: [ConfigModule],
      providers: [
        KafkaClientFactory,
        {
          provide: 'REDIS_FOR_IDEMPOTENCY',
          useFactory: options.redisFactory || (() => undefined),
          inject: options.inject || [],
        },
        {
          provide: IdempotencyService,
          useFactory: async (redis?: Redis, customService?: IIdempotencyService) => {
            if (customService) {
              return customService;
            }
            if (redis) {
              return new IdempotencyService(redis);
            }
            return new NoOpIdempotencyService();
          },
          inject: ['REDIS_FOR_IDEMPOTENCY', { token: 'IDEMPOTENCY_SERVICE', optional: true }],
        },
        {
          provide: 'IDEMPOTENCY_SERVICE',
          useValue: options.idempotencyService,
        },
        {
          provide: DLQService,
          useFactory: async (factory: KafkaClientFactory) => {
            try {
              if (!process.env.KAFKA_BROKERS) {
                return null;
              }
              const client = await factory.getKafkaClient();
              return new DLQService(client);
            } catch {
              return null;
            }
          },
          inject: [KafkaClientFactory],
        },
        EventPublisherService,
        StorageLifecycleEventsService,
        KafkaTopicInitializerService,
      ],
      exports: [
        KafkaClientFactory,
        EventPublisherService,
        StorageLifecycleEventsService,
        IdempotencyService,
        DLQService,
        KafkaTopicInitializerService,
      ],
    };
  }
}

