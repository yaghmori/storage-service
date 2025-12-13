import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RedisConfig } from '../config/redis.config';
import { QueuesService } from './queues.service';
import { IMAGE_PROCESSING_QUEUE, VIDEO_PROCESSING_QUEUE, METADATA_EXTRACTION_QUEUE } from './queue-names';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (redisConfig: RedisConfig) => ({
        connection: redisConfig.connectionOptions,
      }),
      inject: [RedisConfig],
    }),
    BullModule.registerQueue(
      {
        name: IMAGE_PROCESSING_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: VIDEO_PROCESSING_QUEUE,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      },
      {
        name: METADATA_EXTRACTION_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
    ),
  ],
  providers: [QueuesService],
  exports: [BullModule, QueuesService],
})
export class QueuesModule {}

