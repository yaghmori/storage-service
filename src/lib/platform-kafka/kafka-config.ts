// Typed Kafka configuration with Zod validation
// Ensures type safety and validates configuration at startup

import { z } from 'zod';

/**
 * SSL/TLS configuration for Kafka
 */
export const KafkaSSLConfigSchema = z.object({
  enabled: z.boolean().default(false),
  ca: z.string().optional(),
  cert: z.string().optional(),
  key: z.string().optional(),
  rejectUnauthorized: z.boolean().default(true),
});

export type KafkaSSLConfig = z.infer<typeof KafkaSSLConfigSchema>;

/**
 * SASL authentication configuration for Kafka
 */
export const KafkaSASLConfigSchema = z.object({
  mechanism: z.enum(['plain', 'scram-sha-256', 'scram-sha-512']),
  username: z.string().min(1),
  password: z.string().min(1),
});

export type KafkaSASLConfig = z.infer<typeof KafkaSASLConfigSchema>;

/**
 * Retry configuration for Kafka producer
 */
export const KafkaRetryConfigSchema = z.object({
  retries: z.number().int().min(0).max(10).default(3),
  initialRetryTime: z.number().int().min(0).default(100),
  maxRetryTime: z.number().int().min(0).default(30000),
});

export type KafkaRetryConfig = z.infer<typeof KafkaRetryConfigSchema>;

/**
 * Complete Kafka configuration schema
 */
export const KafkaConfigSchema = z.object({
  brokers: z.array(z.string().min(1)).min(1, 'At least one broker is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  groupId: z.string().optional(),
  ssl: KafkaSSLConfigSchema.optional(),
  sasl: KafkaSASLConfigSchema.optional(),
  retry: KafkaRetryConfigSchema.optional(),
  /** Max ms without consumer heartbeat before the broker drops the member (long builds need higher values). */
  consumerSessionTimeoutMs: z.number().int().min(10000).optional(),
  consumerHeartbeatIntervalMs: z.number().int().min(1000).optional(),
});

export type KafkaConfig = z.infer<typeof KafkaConfigSchema>;

/**
 * Create KafkaConfig from environment variables.
 * Validates configuration and throws if invalid.
 */
export function createKafkaConfigFromEnv(env: Record<string, string | undefined>): KafkaConfig {
  const brokers = env['KAFKA_BROKERS'];
  if (!brokers) {
    throw new Error('KAFKA_BROKERS environment variable is required');
  }

  const clientId = env['KAFKA_CLIENT_ID'];
  if (!clientId) {
    throw new Error('KAFKA_CLIENT_ID environment variable is required');
  }

  const config: Partial<KafkaConfig> = {
    brokers: brokers.split(',').map((b) => b.trim()),
    clientId,
    groupId: env['KAFKA_GROUP_ID'],
  };

  // SSL configuration
  if (env['KAFKA_SSL_ENABLED'] === 'true') {
    config.ssl = {
      enabled: true,
      ca: env['KAFKA_SSL_CA_PATH'],
      cert: env['KAFKA_SSL_CERT_PATH'],
      key: env['KAFKA_SSL_KEY_PATH'],
      rejectUnauthorized: env['KAFKA_SSL_REJECT_UNAUTHORIZED'] !== 'false',
    };
  }

  // SASL configuration
  if (env['KAFKA_SASL_MECHANISM'] && env['KAFKA_SASL_USERNAME'] && env['KAFKA_SASL_PASSWORD']) {
    const mechanism = env['KAFKA_SASL_MECHANISM'];
    if (mechanism !== 'plain' && mechanism !== 'scram-sha-256' && mechanism !== 'scram-sha-512') {
      throw new Error(`Invalid KAFKA_SASL_MECHANISM: ${mechanism}. Must be one of: plain, scram-sha-256, scram-sha-512`);
    }
    config.sasl = {
      mechanism: mechanism as 'plain' | 'scram-sha-256' | 'scram-sha-512',
      username: env['KAFKA_SASL_USERNAME']!,
      password: env['KAFKA_SASL_PASSWORD']!,
    };
  }

  // Retry configuration
  if (env['KAFKA_RETRY_RETRIES'] || env['KAFKA_RETRY_INITIAL_TIME'] || env['KAFKA_RETRY_MAX_TIME']) {
    config.retry = {
      retries: env['KAFKA_RETRY_RETRIES'] ? parseInt(env['KAFKA_RETRY_RETRIES'], 10) : 3,
      initialRetryTime: env['KAFKA_RETRY_INITIAL_TIME'] ? parseInt(env['KAFKA_RETRY_INITIAL_TIME'], 10) : 100,
      maxRetryTime: env['KAFKA_RETRY_MAX_TIME'] ? parseInt(env['KAFKA_RETRY_MAX_TIME'], 10) : 30000,
    };
  }

  if (env['KAFKA_SESSION_TIMEOUT_MS']) {
    config.consumerSessionTimeoutMs = parseInt(env['KAFKA_SESSION_TIMEOUT_MS'], 10);
  }
  if (env['KAFKA_HEARTBEAT_INTERVAL_MS']) {
    config.consumerHeartbeatIntervalMs = parseInt(env['KAFKA_HEARTBEAT_INTERVAL_MS'], 10);
  }

  // Validate and return
  return KafkaConfigSchema.parse(config);
}

