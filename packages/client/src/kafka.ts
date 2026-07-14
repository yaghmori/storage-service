import { EVENT_TYPES, TOPICS } from './generated';

export type KafkaConnectionEnv = {
  brokers: string[];
  clientId: string;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
};

export function resolveKafkaConnection(
  env: NodeJS.ProcessEnv = process.env,
): KafkaConnectionEnv {
  const brokers = (env.KAFKA_BROKERS || env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const clientId = env.KAFKA_CLIENT_ID || 'storage-service-client';
  const ssl = env.KAFKA_SSL === 'true' || env.KAFKA_SSL === '1';
  const username = env.KAFKA_SASL_USERNAME || env.KAFKA_USERNAME;
  const password = env.KAFKA_SASL_PASSWORD || env.KAFKA_PASSWORD;
  const mechanism = (env.KAFKA_SASL_MECHANISM || 'plain').toLowerCase() as
    | 'plain'
    | 'scram-sha-256'
    | 'scram-sha-512';

  return {
    brokers,
    clientId,
    ...(ssl ? { ssl: true } : {}),
    ...(username && password ? { sasl: { mechanism, username, password } } : {}),
  };
}

export const StorageKafka = {
  topics: TOPICS,
  eventTypes: EVENT_TYPES,
  connection: resolveKafkaConnection,
} as const;
