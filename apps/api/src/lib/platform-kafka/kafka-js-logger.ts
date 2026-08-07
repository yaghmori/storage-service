import { Logger } from '@nestjs/common';
import { logLevel, type LogEntry } from 'kafkajs';

/**
 * Resolve KafkaJS log verbosity.
 * Defaults to WARN so metadata noise does not drown Nest logs.
 * Override with KAFKA_LOG_LEVEL=error|warn|info|debug|nothing
 */
export function resolveKafkaJsLogLevel(): logLevel {
  const raw = (process.env.KAFKA_LOG_LEVEL || 'warn').toLowerCase();
  switch (raw) {
    case 'nothing':
    case 'silent':
      return logLevel.NOTHING;
    case 'error':
      return logLevel.ERROR;
    case 'info':
      return logLevel.INFO;
    case 'debug':
      return logLevel.DEBUG;
    case 'warn':
    case 'warning':
    default:
      return logLevel.WARN;
  }
}

const NOISY_TOPIC_PATTERNS = [
  /does not host this topic-partition/i,
  /UNKNOWN_TOPIC_OR_PARTITION/i,
  /This server is not the leader for that topic-partition/i,
];

function isNoisyKafkaMetadataLog(entry: LogEntry['log']): boolean {
  const haystack = [entry.message, entry.error, entry.stack]
    .filter((v): v is string => typeof v === 'string')
    .join(' ');
  return NOISY_TOPIC_PATTERNS.some((re) => re.test(haystack));
}

/**
 * KafkaJS logCreator that routes to Nest Logger and suppresses known startup noise.
 */
export function createKafkaJsLogCreator(context = 'KafkaJS') {
  const nest = new Logger(context);

  return () =>
    ({ namespace, level, log }: LogEntry) => {
      if (isNoisyKafkaMetadataLog(log)) {
        return;
      }

      const detail = log.error
        ? `${log.message} (${typeof log.error === 'string' ? log.error : String(log.error)})`
        : log.message;
      const line = namespace ? `[${namespace}] ${detail}` : detail;

      switch (level) {
        case logLevel.ERROR:
          nest.error(line);
          break;
        case logLevel.WARN:
          nest.warn(line);
          break;
        case logLevel.INFO:
          nest.log(line);
          break;
        case logLevel.DEBUG:
          nest.debug(line);
          break;
        default:
          break;
      }
    };
}

export function isRetriableKafkaError(reason: unknown): boolean {
  const err = reason as { type?: string; code?: number; message?: string } | null;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : err?.message || String(reason ?? '');

  if (
    err?.type === 'UNKNOWN_TOPIC_OR_PARTITION' ||
    err?.type === 'NOT_LEADER_FOR_PARTITION' ||
    err?.type === 'LEADER_NOT_AVAILABLE' ||
    err?.type === 'NOT_CONTROLLER' ||
    err?.code === 3
  ) {
    return true;
  }

  return (
    NOISY_TOPIC_PATTERNS.some((re) => re.test(message)) ||
    /Leader not available/i.test(message) ||
    /The group is rebalancing/i.test(message) ||
    /Coordinator not available/i.test(message) ||
    /Connection is closed/i.test(message) ||
    /broker is not available/i.test(message)
  );
}
