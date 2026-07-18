// Event validation utilities
// Provides runtime validation for Kafka events using Zod schemas

import { Logger } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { EventEnvelopeSchema, EventSchemaRegistry } from './event-schemas';
import { EventEnvelope } from './event-types';

const logger = new Logger('EventValidator');

/**
 * Validation result for an event
 */
export interface ValidationResult<T = Record<string, unknown>> {
  valid: boolean;
  event?: EventEnvelope<T>;
  errors?: string[];
  zodError?: ZodError;
}

/**
 * Validate an event envelope structure (base validation).
 * This ensures the event has all required envelope fields.
 */
export function validateEventEnvelope(event: unknown): ValidationResult {
  try {
    const result = EventEnvelopeSchema.safeParse(event);
    if (result.success) {
      return {
        valid: true,
        event: result.data as EventEnvelope,
      };
    } else {
      return {
        valid: false,
        errors: result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`),
        zodError: result.error,
      };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
    };
  }
}

/**
 * Validate an event against its specific schema.
 * First validates the envelope, then validates the payload against the event-specific schema.
 */
export function validateEvent(event: unknown): ValidationResult {
  // First, validate the envelope structure
  const envelopeResult = validateEventEnvelope(event);
  if (!envelopeResult.valid || !envelopeResult.event) {
    return envelopeResult;
  }

  const envelope = envelopeResult.event;

  // Find the schema for this event type
  const schema = EventSchemaRegistry[envelope.eventType];

  if (!schema) {
    // Unknown event type - validate envelope only
    logger.warn(`Unknown event type: ${envelope.eventType}. Validating envelope only.`, {
      messageId: envelope.messageId,
      eventType: envelope.eventType,
    });
    return {
      valid: true,
      event: envelope,
    };
  }

  // Validate against the specific schema
  try {
    const result = (schema as ZodSchema).safeParse(event);
    if (result.success) {
      return {
        valid: true,
        event: result.data as EventEnvelope,
      };
    } else {
      return {
        valid: false,
        errors: result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`),
        zodError: result.error,
      };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
    };
  }
}

/**
 * Validate an event and throw if invalid.
 * Use this when you want validation failures to throw errors.
 */
export function validateEventOrThrow<T = Record<string, unknown>>(event: unknown): EventEnvelope<T> {
  const result = validateEvent(event);
  if (!result.valid || !result.event) {
    const errorMessage = result.errors?.join(', ') || 'Event validation failed';
    throw new Error(`Invalid event: ${errorMessage}`);
  }
  return result.event as EventEnvelope<T>;
}

/**
 * Validate an event and return a typed result.
 * Returns the validated event if valid, null if invalid.
 */
export function validateEventSafe<T = Record<string, unknown>>(event: unknown): EventEnvelope<T> | null {
  const result = validateEvent(event);
  if (!result.valid || !result.event) {
    return null;
  }
  return result.event as EventEnvelope<T>;
}

/**
 * Check if an event type is registered in the schema registry.
 */
export function isEventTypeRegistered(eventType: string): boolean {
  return eventType in EventSchemaRegistry;
}

/**
 * Get the schema for a specific event type.
 */
export function getEventSchema(eventType: string): ZodSchema | undefined {
  return EventSchemaRegistry[eventType];
}

