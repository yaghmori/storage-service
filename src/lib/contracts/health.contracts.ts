import { z } from 'zod';

/**
 * Health Check Contracts
 * These schemas define the API contracts for health check operations
 */

// ============================================================================
// Health Status
// ============================================================================

export const healthStatusSchema = z.enum(['ok', 'error', 'degraded', 'healthy']);

export type HealthStatus = z.infer<typeof healthStatusSchema>;

// ============================================================================
// Database Health
// ============================================================================

export const databaseHealthSchema = z.object({
  status: z.string(),
  latency: z.number().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  error: z.string().optional(),
});

export type DatabaseHealth = z.infer<typeof databaseHealthSchema>;

// ============================================================================
// System Info
// ============================================================================

export const systemMemorySchema = z.object({
  used: z.number(),
  total: z.number(),
  percentage: z.number(),
});

export type SystemMemory = z.infer<typeof systemMemorySchema>;

export const systemInfoSchema = z.object({
  uptime: z.number(),
  memory: systemMemorySchema,
  platform: z.string(),
  nodeVersion: z.string(),
  timestamp: z.string(),
});

export type SystemInfo = z.infer<typeof systemInfoSchema>;

// ============================================================================
// Application Info
// ============================================================================

export const applicationInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  environment: z.string(),
});

export type ApplicationInfo = z.infer<typeof applicationInfoSchema>;

// ============================================================================
// Overall Health Response
// ============================================================================

export const healthCheckResponseSchema = z.object({
  status: z.string(),
  database: databaseHealthSchema,
  system: systemInfoSchema,
  application: applicationInfoSchema,
});

export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;

// ============================================================================
// Health Check Request (empty - no params needed)
// ============================================================================

export const healthCheckRequestSchema = z.object({}).optional();

export type HealthCheckRequest = z.infer<typeof healthCheckRequestSchema>;
