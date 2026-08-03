import { z, ZodSchema, ZodError } from 'zod';
import { BadRequestException } from '@nestjs/common';

/**
 * Utility functions for integrating Zod with NestJS
 */

/**
 * Convert Zod validation errors to a readable format
 * Compatible with Zod 3 and Zod 4 (both use issues array)
 */
export function formatZodErrors(error: unknown): string[] {
  const err = error as { issues?: Array<{ path: (string | number)[]; message: string }> };
  const issues = err?.issues ?? [];
  return issues.map((e) => {
    const path = (e.path || []).join('.');
    return `${path}: ${e.message}`;
  });
}

/**
 * Create a NestJS pipe for validating request body with Zod schema
 */
export function createZodValidationPipe<T extends ZodSchema>(schema: T) {
  return class ZodValidationPipe {
    transform(value: unknown) {
      try {
        return schema.parse(value);
      } catch (error) {
        if (error instanceof ZodError) {
          const errors = formatZodErrors(error);
          throw new BadRequestException({
            message: 'Validation failed',
            errors,
          });
        }
        throw error;
      }
    }
  };
}

/**
 * Validate data with Zod schema and throw NestJS BadRequestException on error
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatZodErrors(error);
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }
    throw error;
  }
}

/**
 * Safe parse with Zod schema - returns result object instead of throwing
 */
export function safeParse<T>(schema: ZodSchema<T>, data: unknown) {
  return schema.safeParse(data);
}

/**
 * Extract TypeScript type from Zod schema
 */
export type InferSchema<T extends ZodSchema> = z.infer<T>;

/**
 * Create a partial version of a Zod schema (all fields optional)
 */
export function createPartialSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

/**
 * Create a pick version of a Zod schema (select specific fields)
 */
export function createPickSchema<T extends z.ZodRawShape, K extends keyof T>(
  schema: z.ZodObject<T>,
  keys: K[],
) {
  return schema.pick(Object.fromEntries(keys.map((k) => [k, true])) as any);
}

/**
 * Create an omit version of a Zod schema (exclude specific fields)
 */
export function createOmitSchema<T extends z.ZodRawShape, K extends keyof T>(
  schema: z.ZodObject<T>,
  keys: K[],
) {
  return schema.omit(Object.fromEntries(keys.map((k) => [k, true])) as any);
}

/**
 * Merge multiple Zod schemas
 */
export function mergeSchemas<T extends z.ZodRawShape, U extends z.ZodRawShape>(
  schema1: z.ZodObject<T>,
  schema2: z.ZodObject<U>,
) {
  return schema1.merge(schema2);
}

/**
 * Helper to validate query parameters (handles string coercion)
 */
export function validateQueryParams<T>(schema: ZodSchema<T>, query: unknown): T {
  return validateOrThrow(schema, query);
}

/**
 * Helper to validate path parameters
 */
export function validatePathParams<T>(schema: ZodSchema<T>, params: unknown): T {
  return validateOrThrow(schema, params);
}

/**
 * Helper to validate request body
 */
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return validateOrThrow(schema, body);
}
