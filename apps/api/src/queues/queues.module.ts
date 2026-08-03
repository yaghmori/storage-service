import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { RedisConfig } from '../config/redis.config';
import { ProcessingModule } from '../processing/processing.module';
import { BullBoardSetupService } from './bull-board-setup.service';
import { BullBoardController } from './bull-board.controller';
import {
  AI_VISION_QUEUE,
  DEDUPE_PHASH_QUEUE,
  DOCUMENT_OCR_QUEUE,
  DOCUMENT_PREVIEW_QUEUE,
  DOCUMENT_TEXT_QUEUE,
  IMAGE_NORMALIZE_QUEUE,
  IMAGE_PROCESSING_QUEUE,
  INTEGRITY_VERIFY_QUEUE,
  METADATA_EXTRACTION_QUEUE,
  NOTIFY_WEBHOOK_QUEUE,
  VIDEO_PROCESSING_QUEUE,
} from './queue-names';
import { QueuesService } from './queues.service';

const defaultAttempts = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
};

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ProcessingModule),
    BullModule.forRootAsync({
      useFactory: (redisConfig: RedisConfig) => ({
        connection: redisConfig.connectionOptions,
      }),
      inject: [RedisConfig],
    }),
    BullModule.registerQueue(
      { name: IMAGE_NORMALIZE_QUEUE, defaultJobOptions: defaultAttempts },
      { name: IMAGE_PROCESSING_QUEUE, defaultJobOptions: defaultAttempts },
      {
        name: VIDEO_PROCESSING_QUEUE,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      },
      { name: METADATA_EXTRACTION_QUEUE, defaultJobOptions: defaultAttempts },
      {
        name: AI_VISION_QUEUE,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
        },
      },
      { name: DEDUPE_PHASH_QUEUE, defaultJobOptions: defaultAttempts },
      { name: INTEGRITY_VERIFY_QUEUE, defaultJobOptions: defaultAttempts },
      { name: DOCUMENT_PREVIEW_QUEUE, defaultJobOptions: defaultAttempts },
      { name: DOCUMENT_TEXT_QUEUE, defaultJobOptions: defaultAttempts },
      {
        name: DOCUMENT_OCR_QUEUE,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
        },
      },
      {
        name: NOTIFY_WEBHOOK_QUEUE,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 3000 },
        },
      },
    ),
  ],
  controllers: [BullBoardController],
  providers: [QueuesService, BullBoardSetupService],
  exports: [BullModule, QueuesService],
})
export class QueuesModule {}
