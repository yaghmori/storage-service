import { KAFKA_TOPICS } from '../contracts';
import { EventTypes } from './event-types';

/**
 * Maps event types (versioned or legacy) to Kafka topic names.
 */
export function getTopicForEventType(eventType: string): string {
  let baseType = eventType;
  if (eventType.startsWith('evt.')) {
    const parts = eventType.replace(/^evt\./, '').replace(/\.v\d+$/, '').split('.');
    if (parts.length >= 3) {
      baseType = `${parts[0]}.${parts[parts.length - 1]}`;
      if (parts[0] === 'email' && parts[1] === 'message') {
        baseType = `email.${parts[2] === 'send' ? 'send.requested' : parts[2]}`;
      } else if (parts[0] === 'storage' && parts[1] === 'file') {
        baseType = `file.${parts[2]}`;
      } else if (parts[0] === 'notification' && parts[1] === 'message') {
        baseType = `notification.${parts[2] === 'send' ? 'send.requested' : parts[2]}`;
      }
    }
  }

  const topicMap: Record<string, string> = {
    [EventTypes.EMAIL_SENT]: KAFKA_TOPICS.EMAIL_SENT,
    [EventTypes.EMAIL_VERIFIED]: KAFKA_TOPICS.EMAIL_VERIFIED,
    [EventTypes.EMAIL_SEND_REQUESTED]: KAFKA_TOPICS.EMAIL_SEND_REQUESTED,
    [EventTypes.EMAIL_QUEUED]: KAFKA_TOPICS.EMAIL_QUEUED,
    [EventTypes.EMAIL_FAILED]: KAFKA_TOPICS.EMAIL_FAILED,
    [EventTypes.EMAIL_BOUNCED]: KAFKA_TOPICS.EMAIL_BOUNCED,
    [EventTypes.FILE_UPLOADED]: KAFKA_TOPICS.FILE_UPLOADED,
    [EventTypes.FILE_DELETED]: KAFKA_TOPICS.FILE_DELETED,
    [EventTypes.FILE_PROCESSED]: KAFKA_TOPICS.FILE_PROCESSED,
    [EventTypes.NOTIFICATION_SEND_REQUESTED]: KAFKA_TOPICS.NOTIFICATION_SEND_REQUESTED,
    [EventTypes.NOTIFICATION_SENT]: KAFKA_TOPICS.NOTIFICATION_SENT,
    [EventTypes.NOTIFICATION_FAILED]: KAFKA_TOPICS.NOTIFICATION_FAILED,
  };

  return topicMap[baseType] || baseType;
}
