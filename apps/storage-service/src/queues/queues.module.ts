import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { RedisConfig } from '../config/redis.config';
import { ProcessingModule } from '../processing/processing.module';
import { BullBoardSetupService } from './bull-board-setup.service';
import { BullBoardController } from './bull-board.controller';
import { IMAGE_PROCESSING_QUEUE, METADATA_EXTRACTION_QUEUE, VIDEO_PROCESSING_QUEUE } from './queue-names';
import { QueuesService } from './queues.service';

@Module({
  imports: [
    forwardRef(() => ProcessingModule),
    BullModule.forRootAsync({
      useFactory: (redisConfig: RedisConfig) => {
        console.log('[QueuesModule] Initializing BullMQ with Redis config:', {
          host: redisConfig.host,
          port: redisConfig.port,
          db: redisConfig.db,
        });
        return {
          connection: redisConfig.connectionOptions,
        };
      },
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
  controllers: [BullBoardController],
  providers: [QueuesService, BullBoardSetupService],
  exports: [BullModule, QueuesService],
})
export class QueuesModule {}
