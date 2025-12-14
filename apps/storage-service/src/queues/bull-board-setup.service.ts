/* eslint-disable @nx/enforce-module-boundaries */
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
/* eslint-enable @nx/enforce-module-boundaries */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisConfig } from '../config/redis.config';
import {
  IMAGE_PROCESSING_QUEUE,
  METADATA_EXTRACTION_QUEUE,
  VIDEO_PROCESSING_QUEUE,
} from './queue-names';

@Injectable()
export class BullBoardSetupService implements OnModuleInit {
  public serverAdapter!: ExpressAdapter;

  constructor(
    @Inject(RedisConfig) private readonly redisConfig: RedisConfig,
  ) {}

  onModuleInit() {
    // Create BullMQ Queue instances directly for Bull Board
    // @nestjs/bull wraps queues, so we create separate instances for monitoring
    const imageQueue = new Queue(IMAGE_PROCESSING_QUEUE, {
      connection: this.redisConfig.connectionOptions,
    });
    const videoQueue = new Queue(VIDEO_PROCESSING_QUEUE, {
      connection: this.redisConfig.connectionOptions,
    });
    const metadataQueue = new Queue(METADATA_EXTRACTION_QUEUE, {
      connection: this.redisConfig.connectionOptions,
    });

    // Create Express adapter
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/api/admin/queues');

    // Create Bull Board with the BullMQ queue instances
    createBullBoard({
      queues: [
        new BullMQAdapter(imageQueue, { readOnlyMode: false }),
        new BullMQAdapter(videoQueue, { readOnlyMode: false }),
        new BullMQAdapter(metadataQueue, { readOnlyMode: false }),
      ],
      serverAdapter: this.serverAdapter,
    });
  }
}
