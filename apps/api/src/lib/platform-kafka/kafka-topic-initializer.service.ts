// Kafka topic initializer - ensures all required topics exist on startup

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { Admin, Kafka, KafkaConfig as KafkaJSConfig, logLevel, SASLOptions } from 'kafkajs';
import { KAFKA_TOPICS } from '../contracts';

export interface TopicConfig {
  topic: string;
  partitions?: number;
  replicationFactor?: number;
  configEntries?: Array<{ name: string; value: string }>;
}

@Injectable()
export class KafkaTopicInitializerService implements OnModuleInit {
  private readonly logger = new Logger(KafkaTopicInitializerService.name);
  private admin: Admin | null = null;
  private kafka: Kafka | null = null;

  constructor(@Optional() private readonly configService: ConfigService | null) {}

  async onModuleInit() {
    if (!this.configService) {
      this.logger.warn('ConfigService not available, skipping topic initialization');
      return;
    }

    const brokers = this.configService.get<string>('KAFKA_BROKERS');
    const autoCreateTopics = this.configService.get<string>('KAFKA_AUTO_CREATE_TOPICS') !== 'false';

    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not configured, topic initialization skipped');
      return;
    }

    if (!autoCreateTopics) {
      this.logger.log('KAFKA_AUTO_CREATE_TOPICS is disabled, topic initialization skipped');
      return;
    }

    try {
      await this.initializeTopics();
    } catch (error) {
      this.logger.error('Failed to initialize Kafka topics', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - allow service to start even if topic creation fails
      // Topics might already exist or be created manually
    }
  }

  /**
   * Initialize all required Kafka topics
   */
  async initializeTopics(): Promise<void> {
    if (!this.configService) {
      throw new Error('ConfigService not available');
    }

    const brokers = this.configService.get<string>('KAFKA_BROKERS');
    if (!brokers) {
      throw new Error('KAFKA_BROKERS not configured');
    }

    // Get all topics from KAFKA_TOPICS constant
    const allTopics = Object.values(KAFKA_TOPICS) as string[];

    // Default topic configuration
    const defaultPartitions = parseInt(
      this.configService.get<string>('KAFKA_TOPIC_PARTITIONS') || '1',
      10
    );
    const defaultReplicationFactor = parseInt(
      this.configService.get<string>('KAFKA_TOPIC_REPLICATION_FACTOR') || '1',
      10
    );

    // Create topic configs
    const topicConfigs: TopicConfig[] = allTopics.map((topic) => ({
      topic,
      partitions: defaultPartitions,
      replicationFactor: defaultReplicationFactor,
    }));

    await this.createTopics(topicConfigs);
  }

  /**
   * Create Kafka topics if they don't exist
   */
  async createTopics(topicConfigs: TopicConfig[]): Promise<void> {
    if (topicConfigs.length === 0) {
      this.logger.log('No topics to create');
      return;
    }

    if (!this.configService) {
      throw new Error('ConfigService not available');
    }

    const brokers = this.configService.get<string>('KAFKA_BROKERS');
    if (!brokers) {
      throw new Error('KAFKA_BROKERS not configured');
    }

    // Initialize Kafka and Admin client
    if (!this.kafka) {
      this.kafka = this.createKafkaInstance();
    }

    if (!this.admin) {
      this.admin = this.kafka.admin();
      await this.admin.connect();
      this.logger.log('Kafka Admin client connected');
    }

    try {
      // Check which topics already exist
      const existingTopics = await this.admin.listTopics();
      const topicsToCreate = topicConfigs.filter(
        (config) => !existingTopics.includes(config.topic)
      );

      if (topicsToCreate.length === 0) {
        this.logger.log(`All ${topicConfigs.length} topics already exist`);
        return;
      }

      this.logger.log(
        `Creating ${topicsToCreate.length} topics (${existingTopics.length} already exist)...`
      );

      // Create topics
      const createTopicResults = await this.admin.createTopics({
        topics: topicsToCreate.map((config) => ({
          topic: config.topic,
          numPartitions: config.partitions || 1,
          replicationFactor: config.replicationFactor || 1,
          configEntries: config.configEntries || [],
        })),
        waitForLeaders: true, // Wait for partition leaders to be available
        timeout: 30000, // 30 seconds
      });

      if (createTopicResults) {
        const createdTopics = topicsToCreate.map((c) => c.topic);
        this.logger.log(`✅ Successfully created ${createdTopics.length} topics: ${createdTopics.join(', ')}`);
      } else {
        this.logger.warn('Topic creation returned false - topics may not have been created');
      }
    } catch (error) {
      const kafkaError = error as { type?: string; code?: number; message?: string };

      // Handle topic already exists error gracefully
      if (
        kafkaError.type === 'TOPIC_ALREADY_EXISTS' ||
        kafkaError.code === 36 ||
        kafkaError.message?.includes('already exists')
      ) {
        this.logger.log('Topics already exist (this is OK)');
        return;
      }

      throw error;
    }
  }

  /**
   * Create Kafka instance with configuration from environment
   */
  private createKafkaInstance(): Kafka {
    if (!this.configService) {
      throw new Error('ConfigService not available');
    }

    const brokers = this.configService.get<string>('KAFKA_BROKERS');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID') || 'topic-initializer';

    if (!brokers) {
      throw new Error('KAFKA_BROKERS not configured');
    }

    const kafkaJSConfig: KafkaJSConfig = {
      brokers: brokers.split(',').map((b) => b.trim()),
      clientId,
      logLevel: logLevel.INFO,
    };

    // Add SSL configuration if enabled
    const sslEnabled = this.configService.get<string>('KAFKA_SSL_ENABLED') === 'true';
    if (sslEnabled) {
      const sslCaPath = this.configService.get<string>('KAFKA_SSL_CA_PATH');
      const sslCertPath = this.configService.get<string>('KAFKA_SSL_CERT_PATH');
      const sslKeyPath = this.configService.get<string>('KAFKA_SSL_KEY_PATH');
      const rejectUnauthorized =
        this.configService.get<string>('KAFKA_SSL_REJECT_UNAUTHORIZED') !== 'false';

      kafkaJSConfig.ssl = {
        rejectUnauthorized,
        ...(sslCaPath && { ca: [readFileSync(sslCaPath, 'utf-8')] }),
        ...(sslCertPath && { cert: readFileSync(sslCertPath, 'utf-8') }),
        ...(sslKeyPath && { key: readFileSync(sslKeyPath, 'utf-8') }),
      };
    }

    // Add SASL configuration if provided
    const saslMechanism = this.configService.get<string>('KAFKA_SASL_MECHANISM');
    const saslUsername = this.configService.get<string>('KAFKA_SASL_USERNAME');
    const saslPassword = this.configService.get<string>('KAFKA_SASL_PASSWORD');

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
      this.logger.log('Kafka Admin client disconnected');
    }
  }
}

