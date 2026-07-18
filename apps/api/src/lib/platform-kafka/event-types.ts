// Event types for platform email / storage / notification services

export enum EventTypes {
  EMAIL_SENT = 'email.sent',
  EMAIL_VERIFIED = 'email.verified',
  EMAIL_SEND_REQUESTED = 'email.send.requested',
  EMAIL_QUEUED = 'email.queued',
  EMAIL_FAILED = 'email.failed',
  EMAIL_BOUNCED = 'email.bounced',

  FILE_UPLOADED = 'file.uploaded',
  FILE_DELETED = 'file.deleted',
  FILE_PROCESSED = 'file.processed',

  NOTIFICATION_SEND_REQUESTED = 'notification.send.requested',
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_FAILED = 'notification.failed',
}

/**
 * Standard event envelope for all Kafka messages.
 * Event naming: evt.<domain>.<entity>.<action>.v<major>
 */
export interface EventEnvelope<T = Record<string, unknown>> {
  messageId: string;
  eventType: string;
  eventVersion: number;
  timestamp: string;
  source: string;
  correlationId?: string;
  causationId?: string;
  tenantId?: string;
  payload: T;
}

/** @deprecated Use EventEnvelope */
export interface AppEvent {
  type: EventTypes | string;
  eventId?: string;
  timestamp: string | Date;
  source: string;
  data: Record<string, unknown>;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailEventData {
  to: string;
  template?: string;
  locale?: string;
  data?: Record<string, unknown>;
  tenantId?: string;
}
