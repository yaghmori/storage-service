// NestJS service for publishing events via Kafka
// Uses KafkaClientFactory when available (via KafkaModule) for singleton client management
// Falls back to creating its own client for backward compatibility

import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { EventEnvelope } from './event-types';
import { getTopicForEventType } from './event-topic-mapper';
import { KafkaClient } from './kafka-client';
import { KafkaClientFactory } from './kafka-client-factory';

@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private kafkaClient: KafkaClient | null = null;
  private useFactory: boolean;

  constructor(
    @Optional() private readonly configService: ConfigService | undefined,
    @Optional() private readonly kafkaClientFactory?: KafkaClientFactory,
  ) {
    // Prefer factory if available (when KafkaModule is imported)
    this.useFactory = !!kafkaClientFactory;
  }

  async onModuleInit() {
    // If factory is available, use it (via KafkaModule)
    if (this.useFactory && this.kafkaClientFactory) {
      try {
        this.kafkaClient = await this.kafkaClientFactory.getKafkaClient();
        this.logger.log('Event publisher service initialized with KafkaClientFactory');
        return;
      } catch (error: unknown) {
        this.logger.error('Failed to get Kafka client from factory, falling back to direct creation', error);
        // Fall through to create own client
      }
    }

    // Fallback: Create own client (for backward compatibility)
    if (!this.configService) {
      this.logger.warn('ConfigService not available, using environment variables directly');
    }

    const brokers = this.configService?.get<string>('KAFKA_BROKERS') || process.env['KAFKA_BROKERS'];
    const clientId = this.configService?.get<string>('KAFKA_CLIENT_ID') || process.env['KAFKA_CLIENT_ID'] || 'event-publisher';

    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not configured, event publishing will be disabled');
      return;
    }

    try {
      this.kafkaClient = new KafkaClient({
        brokers: brokers.split(',').map((b) => b.trim()),
        clientId,
      });
      this.logger.log('Event publisher service initialized with direct client (consider using KafkaModule)');
    } catch (error) {
      this.logger.error('Failed to initialize Kafka client', error);
    }
  }

  async onModuleDestroy() {
    // Only destroy client if we created it ourselves (not from factory)
    // Factory manages its own client lifecycle
    if (this.kafkaClient && !this.useFactory) {
      await this.kafkaClient.onModuleDestroy();
    }
  }

  /**
   * Publish an event to Kafka using the standard EventEnvelope format.
   * This is the preferred method for publishing events.
   */
  async publishEventEnvelope<T = Record<string, unknown>>(
    envelope: Omit<EventEnvelope<T>, 'messageId' | 'timestamp'>,
    correlationId?: string,
    causationId?: string,
  ): Promise<void> {
    // Lazy initialization: ensure we have a client (handles init order race)
    if (!this.kafkaClient) {
      if (this.useFactory && this.kafkaClientFactory) {
        try {
          this.kafkaClient = await this.kafkaClientFactory.getKafkaClient();
          this.logger.log('Event publisher service initialized with KafkaClientFactory (lazy)');
        } catch (error) {
          this.logger.error('Failed to get Kafka client from factory', error);
        }
      }
      // Fallback: create client from env if factory didn't work
      if (!this.kafkaClient) {
        const brokers = this.configService?.get<string>('KAFKA_BROKERS') || process.env['KAFKA_BROKERS'];
        const clientId = this.configService?.get<string>('KAFKA_CLIENT_ID') || process.env['KAFKA_CLIENT_ID'] || 'event-publisher';
        if (brokers) {
          try {
            this.kafkaClient = new KafkaClient({
              brokers: brokers.split(',').map((b) => b.trim()),
              clientId,
            });
            this.logger.log('Event publisher service initialized with direct client (lazy fallback)');
          } catch (error) {
            this.logger.error('Failed to initialize Kafka client in fallback', error);
          }
        }
      }
    }
    if (!this.kafkaClient) {
      this.logger.warn('Kafka client not initialized, event not published', { eventType: envelope.eventType });
      return;
    }

    const fullEnvelope: EventEnvelope<T> = {
      ...envelope,
      messageId: randomUUID(),
      timestamp: new Date().toISOString(),
      correlationId: envelope.correlationId || correlationId,
      causationId: envelope.causationId || causationId,
    };

    // Map event type to Kafka topic
    const topic = getTopicForEventType(envelope.eventType);

    try {
      await this.kafkaClient.publish(topic, fullEnvelope);
      this.logger.debug(`Event published: ${envelope.eventType}`, {
        messageId: fullEnvelope.messageId,
        correlationId: fullEnvelope.correlationId,
        causationId: fullEnvelope.causationId,
      });
    } catch (error) {
      this.logger.error(`Failed to publish event: ${envelope.eventType}`, error);
      // Don't throw - event failures shouldn't break the main flow
    }
  }

}
