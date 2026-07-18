// Kafka topic names for platform email / storage / notification

export const KAFKA_TOPICS = {
  // Email
  EMAIL_SENT: 'email.sent',
  EMAIL_VERIFIED: 'email.verified',
  EMAIL_SEND_REQUESTED: 'email.send.requested',
  EMAIL_QUEUED: 'email.queued',
  EMAIL_FAILED: 'email.failed',
  EMAIL_BOUNCED: 'email.bounced',

  // Storage (platform assets)
  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
  FILE_PROCESSED: 'file.processed',

  // Notification (Phase B — contracts only in Phase A)
  NOTIFICATION_SEND_REQUESTED: 'notification.send.requested',
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_FAILED: 'notification.failed',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

export const EMAIL_EVENT_TYPES = {
  SEND: 'evt.email.message.send.v1',
  QUEUED: 'evt.email.message.queued.v1',
  SENT: 'evt.email.message.sent.v1',
  FAILED: 'evt.email.message.failed.v1',
  BOUNCED: 'evt.email.message.bounced.v1',
  VERIFIED: 'evt.email.message.verified.v1',
} as const;

export const STORAGE_EVENT_TYPES = {
  UPLOADED: 'evt.storage.file.uploaded.v1',
  DELETED: 'evt.storage.file.deleted.v1',
  PROCESSED: 'evt.storage.file.processed.v1',
} as const;

export const NOTIFICATION_EVENT_TYPES = {
  SEND: 'evt.notification.message.send.v1',
  SENT: 'evt.notification.message.sent.v1',
  FAILED: 'evt.notification.message.failed.v1',
} as const;
