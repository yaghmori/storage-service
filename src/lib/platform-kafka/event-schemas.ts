/**
 * Re-export platform event schemas from messaging-contracts.
 * EventSchemaRegistry alias keeps Kafka client validators working.
 */
export {
  EventEnvelopeSchema,
  EventSchemaRegistry,
  PlatformEventSchemaRegistry,
  EmailSendRequestedPayloadSchema,
  EmailQueuedPayloadSchema,
  EmailSentPayloadSchema,
  EmailFailedPayloadSchema,
  EmailBouncedPayloadSchema,
  FileUploadedPayloadSchema,
  FileDeletedPayloadSchema,
  FileProcessedPayloadSchema,
  EmailSendRequestedEventSchema,
  EmailQueuedEventSchema,
  EmailSentEventSchema,
  EmailFailedEventSchema,
  EmailBouncedEventSchema,
  FileUploadedEventSchema,
  FileDeletedEventSchema,
  FileProcessedEventSchema,
  type EventEnvelopeType,
} from '@platform/messaging-contracts';
