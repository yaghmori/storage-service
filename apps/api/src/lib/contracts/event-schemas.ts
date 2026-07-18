// Zod schemas for platform event envelopes (email / storage / notification)

import { z } from 'zod';
import { uuidSchema } from './common.schemas';

export const EventEnvelopeSchema = z.object({
  messageId: uuidSchema,
  eventType: z.string().regex(/^evt\.[a-z]+\.[a-z]+\.[a-z]+\.v\d+$/, {
    message: 'Event type must follow format: evt.<domain>.<entity>.<action>.v<major>',
  }),
  eventVersion: z.number().int().min(1),
  timestamp: z.string().datetime(),
  source: z.string().min(1),
  correlationId: uuidSchema.optional(),
  causationId: uuidSchema.optional(),
  tenantId: uuidSchema.optional(),
  payload: z.record(z.string(), z.unknown()),
});

export type EventEnvelopeType = z.infer<typeof EventEnvelopeSchema>;

export const EmailSendRequestedPayloadSchema = z.object({
  to: z.string().email().or(z.array(z.string().email())),
  template: z.string().optional(),
  locale: z.string().optional(),
  tenantId: uuidSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  from: z.string().email().optional(),
  fromName: z.string().optional(),
  subject: z.string().optional(),
  provider: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const EmailQueuedPayloadSchema = z.object({
  messageId: uuidSchema,
  to: z.string().email(),
  template: z.string().optional(),
  tenantId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const EmailSentPayloadSchema = z.object({
  messageId: uuidSchema,
  to: z.string().email(),
  provider: z.string(),
  providerMessageId: z.string().optional(),
  template: z.string().optional(),
  tenantId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const EmailFailedPayloadSchema = z.object({
  messageId: uuidSchema,
  to: z.string().email(),
  error: z.string(),
  attempts: z.number().int().min(0),
  template: z.string().optional(),
  tenantId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const EmailBouncedPayloadSchema = z.object({
  messageId: uuidSchema,
  to: z.string().email(),
  bounceType: z.enum(['hard', 'soft']),
  reason: z.string(),
  provider: z.string(),
  tenantId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const FileUploadedPayloadSchema = z.object({
  fileId: uuidSchema,
  fileName: z.string(),
  fileSize: z.number().int().min(0),
  mimeType: z.string(),
  tenantId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const FileDeletedPayloadSchema = z.object({
  fileId: uuidSchema,
  tenantId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const FileProcessedPayloadSchema = z.object({
  fileId: uuidSchema,
  processingType: z.string(),
  tenantId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Phase B notification envelope — consumer composes title/body/metadata.
 * Opaque userId (string) so consumers are not tied to a shared auth UUID scheme.
 */
export const NotificationSendRequestedPayloadSchema = z.object({
  userId: z.string().min(1),
  eventKey: z.string().min(1),
  title: z.string().optional(),
  body: z.string().optional(),
  message: z.string().optional(),
  channels: z.array(z.string()).optional(),
  emailTemplate: z.string().optional(),
  inAppTemplate: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  actionUrl: z.string().optional(),
  tenantId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const NotificationSentPayloadSchema = z.object({
  notificationId: z.string().min(1),
  userId: z.string().min(1),
  tenantId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const NotificationFailedPayloadSchema = z.object({
  notificationId: z.string().min(1),
  userId: z.string().min(1),
  error: z.string(),
  tenantId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const EmailSendRequestedEventSchema = EventEnvelopeSchema.extend({
  eventType: z.literal('evt.email.message.send.v1'),
  payload: EmailSendRequestedPayloadSchema,
});

export const EmailQueuedEventSchema = EventEnvelopeSchema.extend({
  eventType: z.literal('evt.email.message.queued.v1'),
  payload: EmailQueuedPayloadSchema,
});

export const EmailSentEventSchema = EventEnvelopeSchema.extend({
  eventType: z.literal('evt.email.message.sent.v1'),
  payload: EmailSentPayloadSchema,
});

export const EmailFailedEventSchema = EventEnvelopeSchema.extend({
  eventType: z.literal('evt.email.message.failed.v1'),
  payload: EmailFailedPayloadSchema,
});

export const EmailBouncedEventSchema = EventEnvelopeSchema.extend({
  eventType: z.literal('evt.email.message.bounced.v1'),
  payload: EmailBouncedPayloadSchema,
});

export const FileUploadedEventSchema = EventEnvelopeSchema.extend({
  eventType: z.literal('evt.storage.file.uploaded.v1'),
  payload: FileUploadedPayloadSchema,
});

export const FileDeletedEventSchema = EventEnvelopeSchema.extend({
  eventType: z.literal('evt.storage.file.deleted.v1'),
  payload: FileDeletedPayloadSchema,
});

export const FileProcessedEventSchema = EventEnvelopeSchema.extend({
  eventType: z.literal('evt.storage.file.processed.v1'),
  payload: FileProcessedPayloadSchema,
});

export const NotificationSendRequestedEventSchema = EventEnvelopeSchema.extend({
  eventType: z.literal('evt.notification.message.send.v1'),
  payload: NotificationSendRequestedPayloadSchema,
});

export const PlatformEventSchemaRegistry: Record<string, z.ZodSchema> = {
  'evt.email.message.send.v1': EmailSendRequestedEventSchema,
  'evt.email.message.queued.v1': EmailQueuedEventSchema,
  'evt.email.message.sent.v1': EmailSentEventSchema,
  'evt.email.message.failed.v1': EmailFailedEventSchema,
  'evt.email.message.bounced.v1': EmailBouncedEventSchema,
  'evt.storage.file.uploaded.v1': FileUploadedEventSchema,
  'evt.storage.file.deleted.v1': FileDeletedEventSchema,
  'evt.storage.file.processed.v1': FileProcessedEventSchema,
  'evt.notification.message.send.v1': NotificationSendRequestedEventSchema,
};

/** @deprecated Use PlatformEventSchemaRegistry — alias for Parslinks shared-events migration */
export const EventSchemaRegistry = PlatformEventSchemaRegistry;
