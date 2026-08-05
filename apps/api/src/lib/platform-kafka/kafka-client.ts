// Kafka client utilities for producer and consumer

import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { readFileSync } from 'fs';
import { Consumer, ConsumerConfig, Kafka, KafkaConfig as KafkaJSConfig, logLevel, Producer, ProducerConfig, SASLOptions } from 'kafkajs';
import { DLQService } from './dlq.service';
import { classifyError } from './error-classifier';
import { validateEvent, validateEventEnvelope, ValidationResult } from './event-validator';
import type { IIdempotencyService } from './idempotency.service';
import { KafkaConfig } from './kafka-config';

/**
 * @deprecated Use KafkaConfig from kafka-config.ts instead
 */
export interface KafkaClientConfig {
  brokers: string[];
  clientId: string;
  groupId?: string;
}

@Injectable()
export class KafkaClient implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaClient.name);
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private config: KafkaConfig;
  private topicHandlers: Map<string, (message: Record<string, unknown>) => Promise<void>> = new Map();
  private consumerRunning = false;
  private onConsumerCrash?: () => void | Promise<void>;

  private readonly maxRetries: number = 3;

  /** Register a callback when the Kafka consumer crashes (e.g. to auto-restart). */
  setOnConsumerCrash(handler: () => void | Promise<void>): void {
    this.onConsumerCrash = handler;
  }

  constructor(
    config: KafkaConfig | KafkaClientConfig,
    @Optional() private readonly idempotencyService?: IIdempotencyService,
    @Optional() private readonly dlqService?: DLQService,
  ) {
    // Convert to new format if using legacy config
    const kafkaConfig: KafkaConfig = this.normalizeConfig(config);
    this.config = kafkaConfig;

    // Log broker configuration for debugging
    this.logger.log(`Kafka client configured with brokers: ${kafkaConfig.brokers.join(', ')}`);
    this.logger.log(`Kafka client ID: ${kafkaConfig.clientId}`);
    if (kafkaConfig.groupId) {
      this.logger.log(`Kafka group ID: ${kafkaConfig.groupId}`);
    }

    // Build KafkaJS configuration
    const kafkaJSConfig: KafkaJSConfig = {
      brokers: kafkaConfig.brokers,
      clientId: kafkaConfig.clientId,
      logLevel: logLevel.INFO,
    };

    // Add SSL configuration if enabled
    if (kafkaConfig.ssl?.enabled) {
      kafkaJSConfig.ssl = {
        rejectUnauthorized: kafkaConfig.ssl.rejectUnauthorized ?? true,
        ...(kafkaConfig.ssl.ca && { ca: [readFileSync(kafkaConfig.ssl.ca, 'utf-8')] }),
        ...(kafkaConfig.ssl.cert && { cert: readFileSync(kafkaConfig.ssl.cert, 'utf-8') }),
        ...(kafkaConfig.ssl.key && { key: readFileSync(kafkaConfig.ssl.key, 'utf-8') }),
      };
    }

    // Add SASL configuration if provided
    if (kafkaConfig.sasl) {
      const saslOptions: SASLOptions = {
        mechanism: kafkaConfig.sasl.mechanism,
        username: kafkaConfig.sasl.username,
        password: kafkaConfig.sasl.password,
      };
      kafkaJSConfig.sasl = saslOptions;
    }

    this.kafka = new Kafka(kafkaJSConfig);
  }

  /**
   * Normalize config to new KafkaConfig format (for backward compatibility).
   */
  private normalizeConfig(config: KafkaConfig | KafkaClientConfig): KafkaConfig {
    // If already in new format, return as-is
    if ('ssl' in config || 'sasl' in config || 'retry' in config) {
      return config as KafkaConfig;
    }

    // Convert legacy format
    const legacyConfig = config as KafkaClientConfig;
    return {
      brokers: legacyConfig.brokers,
      clientId: legacyConfig.clientId,
      groupId: legacyConfig.groupId,
    };
  }

  /**
   * Get or create a Kafka producer
   */
  async getProducer(): Promise<Producer> {
    if (!this.producer) {
      const producerConfig: ProducerConfig = {
        allowAutoTopicCreation: false, // Don't auto-create topics
        retry: this.config.retry || {
          retries: 3,
          initialRetryTime: 100,
          maxRetryTime: 30000,
        },
      };
      this.producer = this.kafka.producer(producerConfig);
      await this.producer.connect();
      this.logger.log('Kafka producer connected');
    }
    return this.producer;
  }

  /**
   * Get or create a Kafka consumer
   */
  async getConsumer(groupId?: string): Promise<Consumer> {
    if (!this.consumer) {
      const sessionTimeout = this.config.consumerSessionTimeoutMs ?? 30000;
      const heartbeatInterval = this.config.consumerHeartbeatIntervalMs ?? 3000;
      const consumerConfig: ConsumerConfig = {
        groupId: groupId || this.config.groupId || `${this.config.clientId}-group`,
        allowAutoTopicCreation: false, // Don't auto-create topics - they should be created explicitly
        sessionTimeout,
        heartbeatInterval,
        rebalanceTimeout: Math.max(sessionTimeout * 2, 60000),
        maxBytesPerPartition: 1048576, // 1MB
        minBytes: 1,
        maxWaitTimeInMs: 5000, // 5 seconds
      };
      this.consumer = this.kafka.consumer(consumerConfig);
      await this.consumer.connect();
      this.logger.log(
        `Kafka consumer connected (groupId: ${consumerConfig.groupId}, sessionTimeout: ${sessionTimeout}ms)`,
      );

      const { CRASH } = this.consumer.events;
      this.consumer.on(CRASH, async (event) => {
        this.logger.error('Kafka consumer crashed', {
          error: event.payload.error?.message,
          groupId: consumerConfig.groupId,
          restart: event.payload.restart,
        });
        this.consumerRunning = false;
        if (this.onConsumerCrash) {
          try {
            await this.onConsumerCrash();
          } catch (restartError) {
            this.logger.error('Consumer crash handler failed', {
              error: restartError instanceof Error ? restartError.message : String(restartError),
            });
          }
        }
      });
    }
    return this.consumer;
  }

  /**
   * Disconnect and restart the consumer using existing topic handlers.
   */
  async restartConsumer(): Promise<void> {
    if (this.consumer) {
      try {
        await this.consumer.disconnect();
      } catch (error) {
        this.logger.warn('Error disconnecting consumer during restart', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.consumer = null;
    }
    this.consumerRunning = false;

    if (this.topicHandlers.size === 0) {
      this.logger.warn('Cannot restart consumer — no topic handlers registered');
      return;
    }

    const consumer = await this.getConsumer();
    for (const topic of this.topicHandlers.keys()) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    await this.startConsumer();
  }

  /**
   * Publish an event to a Kafka topic.
   * Accepts both EventEnvelope (preferred) and legacy AppEvent formats.
   * Validates the event before publishing (fail fast on invalid events).
   */
  async publish(topic: string, message: unknown): Promise<void> {
    try {
      // Validate event before publishing (fail fast)
      // For legacy events, validate envelope only; for new events, validate full schema
      const validationResult = this.validateMessage(message);
      if (!validationResult.valid) {
        const errorMessage = `Event validation failed: ${validationResult.errors?.join(', ')}`;
        this.logger.error(`Cannot publish invalid event to topic ${topic}`, {
          errors: validationResult.errors,
          message: this.sanitizeMessageForLogging(message),
        });
        throw new Error(errorMessage);
      }

      const producer = await this.getProducer();

      // Extract messageId and other metadata for logging and key selection
      const messageObj = message as { messageId?: string; eventId?: string; userId?: string; correlationId?: string; causationId?: string; eventType?: string; source?: string; tenantId?: string };
      const messageId = messageObj.messageId || messageObj.eventId;
      const correlationId = messageObj.correlationId;
      const causationId = messageObj.causationId;

      // Use messageId as key for partitioning (ensures same messageId goes to same partition)
      // Fallback to userId for legacy events, or undefined for round-robin
      const key = messageId || messageObj.userId || undefined;

      await producer.send({
        topic,
        messages: [
          {
            value: JSON.stringify(message),
            key,
            headers: {
              // Add metadata to headers for easier filtering and tracing
              ...(messageId && { 'x-message-id': messageId }),
              ...(correlationId && { 'x-correlation-id': correlationId }),
              ...(causationId && { 'x-causation-id': causationId }),
              ...(messageObj.eventType && { 'x-event-type': messageObj.eventType }),
              ...(messageObj.source && { 'x-source': messageObj.source }),
              ...(messageObj.tenantId && { 'x-tenant-id': messageObj.tenantId }),
            },
          },
        ],
      });

      this.logger.debug(`Event published to topic ${topic}`, {
        messageId,
        correlationId,
        causationId,
        eventType: messageObj.eventType,
        source: messageObj.source,
        tenantId: messageObj.tenantId,
      });
    } catch (error) {
      const messageObj = message as { messageId?: string; eventId?: string; eventType?: string };
      this.logger.error(`Failed to publish event to topic ${topic}`, {
        error: error instanceof Error ? error.message : String(error),
        messageId: messageObj.messageId || messageObj.eventId,
        eventType: messageObj.eventType,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Validate a message before publishing or processing.
   * Returns validation result with errors if invalid.
   */
  private validateMessage(message: unknown): ValidationResult {
    // Check if it's a new EventEnvelope format
    const messageObj = message as { eventType?: string; messageId?: string; eventId?: string };

    if (messageObj.eventType && messageObj.eventType.startsWith('evt.')) {
      // New format - validate full schema
      return validateEvent(message);
    } else {
      // Legacy format - validate envelope only (backward compatibility)
      return validateEventEnvelope(message);
    }
  }

  /**
   * Sanitize message for logging (remove sensitive data, truncate large payloads).
   */
  private sanitizeMessageForLogging(message: unknown): Record<string, unknown> {
    try {
      const msg = message as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {
        eventType: msg['eventType'] || msg['type'],
        messageId: msg['messageId'] || msg['eventId'],
        source: msg['source'],
      };

      // Include payload/data but truncate if too large
      const payload = msg['payload'] || msg['data'];
      if (payload) {
        const payloadStr = JSON.stringify(payload);
        sanitized['payload'] = payloadStr.length > 500 ? `${payloadStr.substring(0, 500)}...` : payload;
      }

      return sanitized;
    } catch {
      return { raw: 'Unable to parse message' };
    }
  }

  /**
   * Subscribe to a Kafka topic
   * This method can be called multiple times to subscribe to multiple topics.
   * Call startConsumer() after all subscriptions are done to start consuming messages.
   *
   * @throws Error if subscription fails (including if topic doesn't exist)
   */
  async subscribe(
    topic: string,
    handler: (message: Record<string, unknown>) => Promise<void>,
    options?: { fromBeginning?: boolean },
  ): Promise<void> {
    try {
      if (this.consumerRunning) {
        throw new Error('Cannot subscribe to topic while consumer is running. Subscribe to all topics before starting the consumer.');
      }

      const consumer = await this.getConsumer();

      // Store the handler for this topic
      this.topicHandlers.set(topic, handler);

      // Subscribe to the topic (this can be called multiple times before running)
      await consumer.subscribe({ topic, fromBeginning: options?.fromBeginning || false });
      this.logger.log(`Subscribed to topic ${topic}`);
    } catch (error: unknown) {
      // Handle missing topics - log warning but still throw so caller knows it failed
      const kafkaError = error as { type?: string; code?: number };
      if (kafkaError?.type === 'UNKNOWN_TOPIC_OR_PARTITION' || kafkaError?.code === 3) {
        this.logger.warn(
          `Topic ${topic} does not exist yet. It may be created when the first message is published. Subscription failed but service will continue.`,
        );
        // Remove the handler since we didn't successfully subscribe
        this.topicHandlers.delete(topic);
      }
      this.logger.error(`Failed to subscribe to topic ${topic}`, error);
      throw error;
    }
  }

  /**
   * Start the Kafka consumer to begin processing messages from all subscribed topics.
   * This should be called after all subscriptions are complete.
   */
  async startConsumer(): Promise<void> {
    if (this.consumerRunning) {
      this.logger.warn('Consumer is already running');
      return;
    }

    if (this.topicHandlers.size === 0) {
      this.logger.warn('No topics subscribed. Start consumer will have no effect.');
      return;
    }

    try {
      const consumer = await this.getConsumer();
      this.consumerRunning = true;
      // Disable auto-commit - we'll commit manually after successful processing
      await consumer.run({
        autoCommit: false, // Manual offset commits for at-least-once delivery guarantee
        eachMessage: async ({ topic: messageTopic, partition, message }) => {
          const startTime = Date.now();
          const offset = message.offset;

          // Extract metadata from headers for structured logging
          const headers = message.headers || {};
          const messageId = headers['x-message-id']?.toString();
          const correlationId = headers['x-correlation-id']?.toString();
          const causationId = headers['x-causation-id']?.toString();
          const eventType = headers['x-event-type']?.toString();
          const source = headers['x-source']?.toString();
          const tenantId = headers['x-tenant-id']?.toString();

          // Store parsed message for error handling (null if parsing fails)
          let parsed: unknown | null = null;
          let parsedMsg: Record<string, unknown> | null = null;

          try {
            const handler = this.topicHandlers.get(messageTopic);
            if (!handler) {
              this.logger.warn(`No handler found for topic ${messageTopic}`, {
                messageId,
                partition,
                offset,
              });
              return;
            }

            const value = message.value?.toString();
            if (!value) {
              this.logger.warn(`Empty message value for topic ${messageTopic}`, {
                messageId,
                partition,
                offset,
              });
              return;
            }

            // Try to parse JSON - if this fails, we'll handle it as a permanent error
            try {
              parsed = JSON.parse(value);
              parsedMsg = parsed as Record<string, unknown>;
            } catch (parseError) {
              // JSON parse error - treat as permanent error and handle immediately
              const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);
              this.logger.error(`Failed to parse message JSON from topic ${messageTopic}`, {
                error: parseErrorMessage,
                partition,
                offset,
                rawValue: value.length > 200 ? `${value.substring(0, 200)}...` : value,
              });

              // Create a permanent error for JSON parse failures
              const jsonParseError = new Error(`Invalid JSON: ${parseErrorMessage}`);

              // Send to DLQ if available
              if (this.dlqService) {
                try {
                  await this.dlqService.sendToDLQ(
                    { raw: value },
                    jsonParseError,
                    0,
                    partition,
                    offset,
                    messageTopic,
                    this.config.clientId,
                  );
                } catch (dlqError) {
                  this.logger.error(`Failed to send invalid JSON message to DLQ`, {
                    error: dlqError instanceof Error ? dlqError.message : String(dlqError),
                    partition,
                    offset,
                  });
                }
              }

              // Commit offset to skip this invalid message
              await consumer.commitOffsets([
                {
                  topic: messageTopic,
                  partition,
                  offset: (BigInt(offset) + BigInt(1)).toString(),
                },
              ]);

              // Return without throwing - consumer continues processing other messages
              return;
            }

            // Validate message before processing
            const validationResult = this.validateMessage(parsed);
            if (!validationResult.valid) {
              this.logger.warn(`Invalid message received from topic ${messageTopic}`, {
                messageId: messageId || (parsedMsg['messageId'] as string | undefined) || (parsedMsg['eventId'] as string | undefined),
                correlationId: correlationId || (parsedMsg['correlationId'] as string | undefined),
                eventType: eventType || (parsedMsg['eventType'] as string | undefined) || (parsedMsg['type'] as string | undefined),
                partition,
                offset,
                validationErrors: validationResult.errors,
              });
              // Invalid message - will be sent to DLQ in Phase 5
              throw new Error(`Message validation failed: ${validationResult.errors?.join(', ')}`);
            }

            // Extract messageId for idempotency check
            const msgId = messageId || (parsedMsg['messageId'] as string | undefined) || (parsedMsg['eventId'] as string | undefined);

            // Check idempotency if service is available and messageId exists
            if (this.idempotencyService && msgId) {
              const alreadyProcessed = await this.idempotencyService.isProcessed(msgId);
              if (alreadyProcessed) {
                this.logger.debug(`Message ${msgId} already processed, skipping`, {
                  messageId: msgId,
                  correlationId: correlationId || (parsedMsg['correlationId'] as string | undefined),
                  partition,
                  offset,
                });
                // Don't commit offset - let Kafka retry mechanism handle it
                // This ensures we don't lose messages if idempotency check is wrong
                return;
              }
            }

            // Log message received with full context
            this.logger.debug(`Processing message from topic ${messageTopic}`, {
              messageId: msgId,
              correlationId: correlationId || (parsedMsg['correlationId'] as string | undefined),
              causationId: causationId || (parsedMsg['causationId'] as string | undefined),
              eventType: eventType || (parsedMsg['eventType'] as string | undefined) || (parsedMsg['type'] as string | undefined),
              source: source || (parsedMsg['source'] as string | undefined),
              tenantId: tenantId || (parsedMsg['tenantId'] as string | undefined),
              partition,
              offset,
            });

            // Process the message
            await handler(parsed as Record<string, unknown>);

            // Mark as processed after successful processing
            if (this.idempotencyService && msgId) {
              await this.idempotencyService.markProcessed(msgId);
            }

            const duration = Date.now() - startTime;
            this.logger.debug(`Message processed successfully from topic ${messageTopic}`, {
              messageId: msgId,
              correlationId: correlationId || (parsedMsg['correlationId'] as string | undefined),
              partition,
              offset,
              duration,
            });

            // Commit offset only after successful processing
            // This ensures at-least-once delivery: if processing fails, message will be retried
            await consumer.commitOffsets([
              {
                topic: messageTopic,
                partition,
                offset: (BigInt(offset) + BigInt(1)).toString(), // Commit next offset
              },
            ]);

            this.logger.debug(`Offset committed for topic ${messageTopic}`, {
              messageId: msgId,
              partition,
              offset,
            });
          } catch (error) {
            const duration = Date.now() - startTime;

            // Get retry count from headers (if present)
            const retryCountHeader = headers['x-retry-count']?.toString();
            const retryCount = retryCountHeader ? parseInt(retryCountHeader, 10) : 0;

            // Classify error to determine if it's retryable
            const errorClassification = classifyError(error);

            // Safely extract message metadata from parsed message or headers
            const safeMessageId = messageId || (parsedMsg?.['messageId'] as string | undefined) || (parsedMsg?.['eventId'] as string | undefined);
            const safeCorrelationId = correlationId || (parsedMsg?.['correlationId'] as string | undefined);
            const safeEventType = eventType || (parsedMsg?.['eventType'] as string | undefined) || (parsedMsg?.['type'] as string | undefined);

            this.logger.error(`Error processing message from topic ${messageTopic}`, {
              error: error instanceof Error ? error.message : String(error),
              messageId: safeMessageId,
              correlationId: safeCorrelationId,
              eventType: safeEventType,
              partition,
              offset,
              duration,
              retryCount,
              isTransient: errorClassification.isTransient,
              errorCategory: errorClassification.category,
              stack: error instanceof Error ? error.stack : undefined,
            });

            // Handle error based on classification
            if (!errorClassification.isTransient) {
              // Permanent error - send to DLQ immediately and commit offset
              this.logger.warn(`Permanent error detected, sending to DLQ immediately`, {
                messageId: safeMessageId,
                partition,
                offset,
                errorCategory: errorClassification.category,
              });

              if (this.dlqService) {
                // Use already parsed message or raw value if parsing failed
                const dlqMessage = parsedMsg || { raw: message.value?.toString() };
                await this.dlqService.sendToDLQ(
                  dlqMessage,
                  error,
                  retryCount,
                  partition,
                  offset,
                  messageTopic,
                  this.config.clientId,
                );
              }

              // Commit offset for permanent errors (don't retry)
              await consumer.commitOffsets([
                {
                  topic: messageTopic,
                  partition,
                  offset: (BigInt(offset) + BigInt(1)).toString(),
                },
              ]);

              return; // Don't re-throw - message is in DLQ
            }

            // Transient error - check if we should retry
            if (retryCount >= this.maxRetries) {
              // Max retries exceeded - send to DLQ
              this.logger.warn(`Max retries (${this.maxRetries}) exceeded, sending to DLQ`, {
                messageId: safeMessageId,
                partition,
                offset,
                retryCount,
              });

              if (this.dlqService) {
                // Use already parsed message or raw value if parsing failed
                const dlqMessage = parsedMsg || { raw: message.value?.toString() };
                await this.dlqService.sendToDLQ(
                  dlqMessage,
                  error,
                  retryCount,
                  partition,
                  offset,
                  messageTopic,
                  this.config.clientId,
                );
              }

              // Commit offset after sending to DLQ
              await consumer.commitOffsets([
                {
                  topic: messageTopic,
                  partition,
                  offset: (BigInt(offset) + BigInt(1)).toString(),
                },
              ]);

              return; // Don't re-throw - message is in DLQ
            }

            // Transient error with retries remaining - don't commit offset, let Kafka retry
            // Note: Kafka will automatically retry by not committing the offset
            // We could implement custom retry logic here, but letting Kafka handle it is simpler
            this.logger.debug(`Transient error, will retry (attempt ${retryCount + 1}/${this.maxRetries})`, {
              messageId: safeMessageId,
              partition,
              offset,
              retryCount: retryCount + 1,
              retryDelay: errorClassification.retryDelay,
            });

            // Don't commit offset - Kafka will retry the message
            // Re-throw to indicate failure (Kafka will handle retry)
            throw error;
          }
        },
      });
      this.logger.log('Kafka consumer started');
    } catch (error) {
      this.consumerRunning = false;
      this.logger.error('Failed to start Kafka consumer', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.producer) {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    }
    if (this.consumer) {
      await this.consumer.disconnect();
      this.logger.log('Kafka consumer disconnected');
    }
  }
}
