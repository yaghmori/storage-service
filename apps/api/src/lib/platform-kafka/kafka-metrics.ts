// Metrics hooks interface for Kafka observability
// Allows services to implement custom metrics collection (Prometheus, Datadog, etc.)

/**
 * Metrics events that can be tracked
 */
export enum KafkaMetricEvent {
  /** Message published successfully */
  MESSAGE_PUBLISHED = 'message_published',
  /** Message consumed successfully */
  MESSAGE_CONSUMED = 'message_consumed',
  /** Message processing failed */
  MESSAGE_FAILED = 'message_failed',
  /** Message sent to DLQ */
  DLQ_SENT = 'dlq_sent',
  /** Message skipped due to idempotency */
  MESSAGE_SKIPPED_IDEMPOTENT = 'message_skipped_idempotent',
  /** Message validation failed */
  MESSAGE_VALIDATION_FAILED = 'message_validation_failed',
}

/**
 * Metrics data for tracking Kafka operations
 */
export interface KafkaMetricData {
  /** Event type being tracked */
  event: KafkaMetricEvent;
  /** Topic name */
  topic: string;
  /** Partition number (for consumers) */
  partition?: number;
  /** Offset (for consumers) */
  offset?: string;
  /** Message ID */
  messageId?: string;
  /** Correlation ID */
  correlationId?: string;
  /** Event type from message */
  eventType?: string;
  /** Source service */
  source?: string;
  /** Tenant ID */
  tenantId?: string;
  /** Processing duration in milliseconds */
  duration?: number;
  /** Error category (for failures) */
  errorCategory?: string;
  /** Retry count */
  retryCount?: number;
}

/**
 * Interface for Kafka metrics collection.
 * Services can implement this to track metrics with their preferred system
 * (Prometheus, Datadog, CloudWatch, etc.).
 */
export interface IKafkaMetrics {
  /**
   * Record a Kafka metric event.
   * @param data Metric data to record
   */
  recordMetric(data: KafkaMetricData): void;

  /**
   * Record consumer lag (optional - requires additional Kafka admin API calls).
   * @param groupId Consumer group ID
   * @param topic Topic name
   * @param partition Partition number
   * @param lag Lag in messages
   */
  recordLag?(groupId: string, topic: string, partition: number, lag: number): void;
}

/**
 * No-op metrics implementation for when metrics are not needed.
 */
export class NoOpKafkaMetrics implements IKafkaMetrics {
  recordMetric(_data: KafkaMetricData): void {
    // No-op
  }
}

