// Dead Letter Queue (DLQ) service for handling permanently failed messages
// Publishes failed messages to a DLQ topic for manual review and processing

import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEnvelope } from './event-types';
import { KafkaClient } from './kafka-client';

/**
 * DLQ message format - contains original message and failure context
 */
export interface DLQMessage {
  /** Original event envelope that failed */
  originalMessage: EventEnvelope | Record<string, unknown>;
  /** Reason for failure */
  errorReason: string;
  /** Error stack trace if available */
  errorStack?: string;
  /** Service that attempted to process the message */
  sourceService: string;
  /** Timestamp when message failed */
  failedAt: string;
  /** Number of retry attempts before sending to DLQ */
  retryCount: number;
  /** Kafka partition where original message was received */
  partition: number;
  /** Kafka offset of original message */
  offset: string;
  /** Topic where original message was received */
  originalTopic: string;
}

/**
 * Dead Letter Queue service.
 * Publishes failed messages to a DLQ topic for manual review.
 */
@Injectable()
export class DLQService {
  private readonly logger = new Logger(DLQService.name);

  constructor(@Optional() private readonly kafkaClient?: KafkaClient) {
    if (!kafkaClient) {
      this.logger.warn('KafkaClient not provided to DLQService. DLQ publishing will be disabled.');
    }
  }

  /**
   * Send a failed message to the Dead Letter Queue.
   * 
   * @param originalMessage The original event envelope that failed
   * @param error The error that caused the failure
   * @param retryCount Number of retry attempts before sending to DLQ
   * @param partition Kafka partition where message was received
   * @param offset Kafka offset of the message
   * @param originalTopic Original topic where message was received
   * @param sourceService Service that attempted to process the message
   */
  async sendToDLQ(
    originalMessage: EventEnvelope | Record<string, unknown>,
    error: unknown,
    retryCount: number,
    partition: number,
    offset: string,
    originalTopic: string,
    sourceService: string,
  ): Promise<void> {
    if (!this.kafkaClient) {
      this.logger.error('Cannot send message to DLQ: KafkaClient not available', {
        originalTopic,
        partition,
        offset,
      });
      return;
    }

    try {
      const dlqMessage: DLQMessage = {
        originalMessage,
        errorReason: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        sourceService,
        failedAt: new Date().toISOString(),
        retryCount,
        partition,
        offset,
        originalTopic,
      };

      // DLQ topic naming: <original-topic>.dlq
      const dlqTopic = `${originalTopic}.dlq`;

      await this.kafkaClient.publish(dlqTopic, dlqMessage);

      this.logger.warn(`Message sent to DLQ: ${dlqTopic}`, {
        originalTopic,
        partition,
        offset,
        retryCount,
        errorReason: dlqMessage.errorReason,
        messageId: (originalMessage as { messageId?: string; eventId?: string })?.messageId || (originalMessage as { messageId?: string; eventId?: string })?.eventId,
      });
    } catch (dlqError) {
      // Log error but don't throw - DLQ publishing failure shouldn't block the main flow
      this.logger.error(`Failed to send message to DLQ`, {
        error: dlqError instanceof Error ? dlqError.message : String(dlqError),
        originalTopic,
        partition,
        offset,
        stack: dlqError instanceof Error ? dlqError.stack : undefined,
      });
    }
  }

  /**
   * Get DLQ topic name for an original topic.
   */
  static getDLQTopicName(originalTopic: string): string {
    return `${originalTopic}.dlq`;
  }
}

