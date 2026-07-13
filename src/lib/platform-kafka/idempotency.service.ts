// Idempotency service for preventing duplicate message processing
// Uses Redis to track processed messages with TTL-based expiration

import { Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Interface for idempotency checking.
 * Allows custom implementations (e.g., database-based instead of Redis).
 */
export interface IIdempotencyService {
  /**
   * Check if a message has already been processed.
   * @param messageId The unique message identifier
   * @returns true if message was already processed, false otherwise
   */
  isProcessed(messageId: string): Promise<boolean>;

  /**
   * Mark a message as processed.
   * @param messageId The unique message identifier
   * @param ttl Time to live in seconds (default: 7 days)
   */
  markProcessed(messageId: string, ttl?: number): Promise<void>;
}

/**
 * Redis-based idempotency service.
 * Uses Redis keys with TTL to track processed messages.
 * 
 * Key format: kafka:processed:<messageId>
 * TTL: 7 days (configurable, default: 604800 seconds)
 */
@Injectable()
export class IdempotencyService implements IIdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly defaultTtl: number;
  private readonly keyPrefix = 'kafka:processed:';

  constructor(
    @Optional() private readonly redis?: Redis,
    defaultTtlSeconds: number = 7 * 24 * 60 * 60, // 7 days in seconds
  ) {
    this.defaultTtl = defaultTtlSeconds;
    
    if (!redis) {
      this.logger.warn('Redis not provided to IdempotencyService. Idempotency checks will be disabled.');
    }
  }

  /**
   * Check if a message has already been processed.
   */
  async isProcessed(messageId: string): Promise<boolean> {
    if (!this.redis) {
      // If Redis is not available, assume message is not processed (fail open)
      this.logger.debug(`Redis not available, assuming message ${messageId} is not processed`);
      return false;
    }

    try {
      const key = this.getKey(messageId);
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      // On Redis errors, fail open (assume not processed) to avoid blocking message processing
      this.logger.error(`Error checking idempotency for message ${messageId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Mark a message as processed.
   */
  async markProcessed(messageId: string, ttl?: number): Promise<void> {
    if (!this.redis) {
      this.logger.debug(`Redis not available, skipping idempotency mark for message ${messageId}`);
      return;
    }

    try {
      const key = this.getKey(messageId);
      const ttlSeconds = ttl || this.defaultTtl;
      
      // Set key with TTL and timestamp value for debugging
      await this.redis.setex(
        key,
        ttlSeconds,
        JSON.stringify({
          messageId,
          processedAt: new Date().toISOString(),
        }),
      );

      this.logger.debug(`Marked message ${messageId} as processed`, {
        messageId,
        ttl: ttlSeconds,
      });
    } catch (error) {
      // Log error but don't throw - idempotency marking failure shouldn't block processing
      this.logger.error(`Error marking message ${messageId} as processed`, {
        error: error instanceof Error ? error.message : String(error),
        messageId,
      });
    }
  }

  /**
   * Get Redis key for a message ID.
   */
  private getKey(messageId: string): string {
    return `${this.keyPrefix}${messageId}`;
  }
}

/**
 * No-op idempotency service for testing or when idempotency is not required.
 */
@Injectable()
export class NoOpIdempotencyService implements IIdempotencyService {
  async isProcessed(_messageId: string): Promise<boolean> {
    return false;
  }

  async markProcessed(_messageId: string, _ttl?: number): Promise<void> {
    // No-op
  }
}

