// Kafka client factory for singleton client management
// Ensures one Kafka client instance per process

import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { DLQService } from './dlq.service';
import type { IIdempotencyService } from './idempotency.service';
import { IdempotencyService, NoOpIdempotencyService } from './idempotency.service';
import { KafkaClient } from './kafka-client';
import { createKafkaConfigFromEnv, KafkaConfig } from './kafka-config';

/**
 * Factory for creating and managing Kafka clients.
 * Provides singleton Kafka client per process to avoid multiple connections.
 */
@Injectable()
export class KafkaClientFactory implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaClientFactory.name);
  private kafkaClient: KafkaClient | null = null;
  private idempotencyService: IIdempotencyService | null = null;
  private dlqService: DLQService | null = null;

  constructor(@Optional() private readonly redis?: Redis) {}

  /**
   * Get or create the singleton Kafka client.
   * Creates the client on first use with configuration from environment variables.
   */
  async getKafkaClient(): Promise<KafkaClient> {
    if (!this.kafkaClient) {
      const config = this.createConfig();
      if (!config.brokers.length) {
        throw new Error('Kafka is disabled (KAFKA_BROKERS not set)');
      }
      const idempotencyService = await this.getIdempotencyService();
      const dlqService = this.dlqService || undefined;

      this.kafkaClient = new KafkaClient(config, idempotencyService, dlqService);
      this.logger.log('Kafka client factory initialized');

      if (!this.dlqService) {
        this.dlqService = new DLQService(this.kafkaClient);
      }
    }
    return this.kafkaClient;
  }

  /**
   * Get or create the idempotency service.
   */
  async getIdempotencyService(): Promise<IIdempotencyService> {
    if (!this.idempotencyService) {
      if (this.redis) {
        this.idempotencyService = new IdempotencyService(this.redis);
      } else {
        this.logger.warn('Redis not available, using NoOpIdempotencyService');
        this.idempotencyService = new NoOpIdempotencyService();
      }
    }
    return this.idempotencyService;
  }

  /**
   * Get or create the DLQ service.
   * Note: This creates a circular dependency if called from getKafkaClient.
   * DLQService should be created separately after KafkaClient is initialized.
   */
  async getDLQService(): Promise<DLQService> {
    if (!this.dlqService) {
      // Get client without creating DLQ service to avoid circular dependency
      const kafkaClient = this.kafkaClient || await this.getKafkaClient();
      this.dlqService = new DLQService(kafkaClient);
    }
    return this.dlqService;
  }

  /**
   * Create Kafka configuration from environment variables.
   */
  private createConfig(): KafkaConfig {
    try {
      const env = process.env as Record<string, string | undefined>;
      return createKafkaConfigFromEnv(env);
    } catch (error) {
      this.logger.warn(
        `Kafka disabled: ${error instanceof Error ? error.message : 'invalid config'}`,
      );
      return {
        brokers: [],
        clientId: process.env.KAFKA_CLIENT_ID || 'storage-service',
        groupId: process.env.KAFKA_GROUP_ID,
      };
    }
  }

  async onModuleDestroy() {
    if (this.kafkaClient) {
      await this.kafkaClient.onModuleDestroy();
      this.logger.log('Kafka client factory destroyed');
    }
  }
}

