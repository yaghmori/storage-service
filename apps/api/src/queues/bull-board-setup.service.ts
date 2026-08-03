/* eslint-disable @nx/enforce-module-boundaries */
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
/* eslint-enable @nx/enforce-module-boundaries */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisConfig } from '../config/redis.config';
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

@Injectable()
export class BullBoardSetupService implements OnModuleInit {
  public serverAdapter!: ExpressAdapter;

  constructor(
    @Inject(RedisConfig) private readonly redisConfig: RedisConfig,
  ) {}

  onModuleInit() {
    const connection = this.redisConfig.connectionOptions;
    const queues = [
      IMAGE_NORMALIZE_QUEUE,
      IMAGE_PROCESSING_QUEUE,
      VIDEO_PROCESSING_QUEUE,
      METADATA_EXTRACTION_QUEUE,
      AI_VISION_QUEUE,
      DEDUPE_PHASH_QUEUE,
      INTEGRITY_VERIFY_QUEUE,
      DOCUMENT_PREVIEW_QUEUE,
      DOCUMENT_TEXT_QUEUE,
      DOCUMENT_OCR_QUEUE,
      NOTIFY_WEBHOOK_QUEUE,
    ].map((name) => new Queue(name, { connection }));

    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/api/admin/queues');

    createBullBoard({
      queues: queues.map((q) => new BullMQAdapter(q, { readOnlyMode: false })),
      serverAdapter: this.serverAdapter,
    });
  }
}
