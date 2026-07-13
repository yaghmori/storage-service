import { EventTypes } from './event-types';

/**
 * Maps legacy event type strings to versioned format.
 */
export function mapLegacyEventTypeToVersioned(legacyType: string): string {
  if (legacyType.match(/^evt\.[a-z]+\.[a-z]+\.[a-z]+\.v\d+$/)) {
    return legacyType;
  }

  const typeMap: Record<string, string> = {
    [EventTypes.EMAIL_SENT]: 'evt.email.message.sent.v1',
    [EventTypes.EMAIL_VERIFIED]: 'evt.email.verification.verified.v1',
    [EventTypes.EMAIL_SEND_REQUESTED]: 'evt.email.message.send.v1',
    [EventTypes.EMAIL_QUEUED]: 'evt.email.message.queued.v1',
    [EventTypes.EMAIL_FAILED]: 'evt.email.message.failed.v1',
    [EventTypes.EMAIL_BOUNCED]: 'evt.email.message.bounced.v1',
    [EventTypes.FILE_UPLOADED]: 'evt.storage.file.uploaded.v1',
    [EventTypes.FILE_DELETED]: 'evt.storage.file.deleted.v1',
    [EventTypes.FILE_PROCESSED]: 'evt.storage.file.processed.v1',
    [EventTypes.NOTIFICATION_SEND_REQUESTED]: 'evt.notification.message.send.v1',
    [EventTypes.NOTIFICATION_SENT]: 'evt.notification.message.sent.v1',
    [EventTypes.NOTIFICATION_FAILED]: 'evt.notification.message.failed.v1',
  };

  return typeMap[legacyType] || `evt.${legacyType}.v1`;
}

export function extractEventVersion(eventType: string): number {
  const match = eventType.match(/\.v(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}
