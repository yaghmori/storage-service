// Kafka topic initializer - ensures all required topics exist on startup

import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { Admin, Kafka, KafkaConfig as KafkaJSConfig, SASLOptions } from 'kafkajs';
import { KAFKA_TOPICS } from '../contracts';
import { createKafkaJsLogCreator, resolveKafkaJsLogLevel } from './kafka-js-logger';

export interface TopicConfig {
  topic: string;
  partitions?: number;
  replicationFactor?: number;
  configEntries?: Array<{ name: string; value: string }>;
}

@Injectable()
export class KafkaTopicInitializerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaTopicInitializerService.name);
  private admin: Admin | null = null;
  private kafka: Kafka | null = null;

  constructor(@Optional() private readonly configService?: ConfigService) {}

  private env(key: string): string | undefined {
    return this.configService?.get<string>(key) ?? process.env[key];
  }

  async onModuleInit() {
    const brokers = this.env('KAFKA_BROKERS');
    const autoCreateTopics = this.env('KAFKA_AUTO_CREATE_TOPICS') !== 'false';

    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not set; skipping topic initialization');
      return;
    }

    if (!autoCreateTopics) {
      this.logger.log('KAFKA_AUTO_CREATE_TOPICS=false; skipping topic initialization');
      return;
    }

    try {
      await this.initializeTopics();
    } catch (error) {
      this.logger.error(
        `Failed to initialize Kafka topics: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async initializeTopics(): Promise<void> {
    const brokers = this.env('KAFKA_BROKERS');
    if (!brokers) {
      throw new Error('KAFKA_BROKERS not configured');
    }

    const allTopics = Object.values(KAFKA_TOPICS) as string[];
    const defaultPartitions = parseInt(this.env('KAFKA_TOPIC_PARTITIONS') || '1', 10);
    const defaultReplicationFactor = parseInt(
      this.env('KAFKA_TOPIC_REPLICATION_FACTOR') || '1',
      10,
    );

    await this.createTopics(
      allTopics.map((topic) => ({
        topic,
        partitions: defaultPartitions,
        replicationFactor: defaultReplicationFactor,
      })),
    );
  }

  async createTopics(topicConfigs: TopicConfig[]): Promise<void> {
    if (topicConfigs.length === 0) {
      return;
    }

    const brokers = this.env('KAFKA_BROKERS');
    if (!brokers) {
      throw new Error('KAFKA_BROKERS not configured');
    }

    if (!this.kafka) {
      this.kafka = this.createKafkaInstance();
    }

    if (!this.admin) {
      this.admin = this.kafka.admin();
      await this.admin.connect();
    }

    try {
      const existingTopics = await this.admin.listTopics();
      const topicsToCreate = topicConfigs.filter(
        (config) => !existingTopics.includes(config.topic),
      );

      if (topicsToCreate.length === 0) {
        this.logger.log(`Kafka topics ready (${topicConfigs.length} checked)`);
        return;
      }

      this.logger.log(
        `Creating Kafka topics: ${topicsToCreate.map((t) => t.topic).join(', ')}`,
      );

      const created = await this.admin.createTopics({
        topics: topicsToCreate.map((config) => ({
          topic: config.topic,
          numPartitions: config.partitions || 1,
          replicationFactor: config.replicationFactor || 1,
          configEntries: config.configEntries || [],
        })),
        waitForLeaders: true,
        timeout: 30000,
      });

      if (created) {
        this.logger.log(
          `Created topics: ${topicsToCreate.map((c) => c.topic).join(', ')}`,
        );
      } else {
        this.logger.warn('Topic create returned false (topics may already exist)');
      }
    } catch (error) {
      const kafkaError = error as { type?: string; code?: number; message?: string };

      if (
        kafkaError.type === 'TOPIC_ALREADY_EXISTS' ||
        kafkaError.code === 36 ||
        kafkaError.message?.includes('already exists')
      ) {
        this.logger.log('Kafka topics already exist');
        return;
      }

      throw error;
    }
  }

  private createKafkaInstance(): Kafka {
    const brokers = this.env('KAFKA_BROKERS');
    const clientId = this.env('KAFKA_CLIENT_ID') || 'topic-initializer';

    if (!brokers) {
      throw new Error('KAFKA_BROKERS not configured');
    }

    const kafkaJSConfig: KafkaJSConfig = {
      brokers: brokers.split(',').map((b) => b.trim()),
      clientId,
      logLevel: resolveKafkaJsLogLevel(),
      logCreator: createKafkaJsLogCreator('KafkaJS'),
    };

    const sslEnabled = this.env('KAFKA_SSL_ENABLED') === 'true';
    if (sslEnabled) {
      const sslCaPath = this.env('KAFKA_SSL_CA_PATH');
      const sslCertPath = this.env('KAFKA_SSL_CERT_PATH');
      const sslKeyPath = this.env('KAFKA_SSL_KEY_PATH');
      const rejectUnauthorized = this.env('KAFKA_SSL_REJECT_UNAUTHORIZED') !== 'false';

      kafkaJSConfig.ssl = {
        rejectUnauthorized,
        ...(sslCaPath && { ca: [readFileSync(sslCaPath, 'utf-8')] }),
        ...(sslCertPath && { cert: [readFileSync(sslCertPath, 'utf-8')] }),
        ...(sslKeyPath && { key: [readFileSync(sslKeyPath, 'utf-8')] }),
      };
    }

    const saslMechanism = this.env('KAFKA_SASL_MECHANISM');
    const saslUsername = this.env('KAFKA_SASL_USERNAME');
    const saslPassword = this.env('KAFKA_SASL_PASSWORD');

    if (saslMechanism && saslUsername && saslPassword) {
      const saslOptions: SASLOptions = {
        mechanism: saslMechanism as 'plain' | 'scram-sha-256' | 'scram-sha-512',
        username: saslUsername,
        password: saslPassword,
      };
      kafkaJSConfig.sasl = saslOptions;
    }

    return new Kafka(kafkaJSConfig);
  }

  async onModuleDestroy() {
    if (this.admin) {
      await this.admin.disconnect();
    }
  }
}
