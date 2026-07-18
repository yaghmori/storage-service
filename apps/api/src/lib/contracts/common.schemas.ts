import { isIPv4, isIPv6 } from 'net';
import { z } from 'zod';

/**
 * Common validation schemas used across all services
 */

// UUID schema
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Email schema
export const emailSchema = z.string().email('Invalid email address');

// Password schema - at least 8 characters, one uppercase, one lowercase, one number
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Non-empty string
export const nonEmptyStringSchema = z.string().min(1, 'This field cannot be empty');

/** Query param int coercion with stable `number` output (avoids Zod 4 `z.coerce.number()` → `unknown` in `z.infer`). */
function paginationQueryInt(fallback: number, min: number, max?: number) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return fallback;
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) return fallback;
      let x = Math.trunc(n);
      if (x < min) x = min;
      if (max !== undefined && x > max) x = max;
      return x;
    });
}

// Pagination schemas
export const paginationQuerySchema = z.object({
  page: paginationQueryInt(1, 1),
  limit: paginationQueryInt(20, 1, 100),
  offset: paginationQueryInt(0, 0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// Pagination response metadata
export const paginationMetaSchema = z.object({
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

// Date schemas
export const dateStringSchema = z.string().datetime('Invalid date format');
export const dateSchema = z.coerce.date();

// IP Address — use Node `net` + refine so this works with both Zod 3 (docker hoisted) and Zod 4.
export const ipAddressSchema = z.string().refine(
  (val) => isIPv4(val) || isIPv6(val),
  { message: 'Invalid IP address' }
);

// User Agent
export const userAgentSchema = z.string().min(1);

// Priority levels
export const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
export const prioritySchema = priorityEnum.default('normal');

// Boolean coercion for query params
export const booleanQuerySchema = z
  .string()
  .transform((val) => val === 'true' || val === '1')
  .or(z.boolean());

// Locale schema (ISO 639-1)
export const localeSchema = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid locale format');

// Tenant ID
export const tenantIdSchema = z.string().min(1);

// Generic key-value data object
export const dataObjectSchema = z.record(z.string(), z.unknown());

// URL schema
export const urlSchema = z.string().url('Invalid URL format');

// MIME type
export const mimeTypeSchema = z.string().regex(/^[a-z]+\/[a-z0-9\-+ .]+$/i, 'Invalid MIME type');

// File size (in bytes)
export const fileSizeSchema = z.number().int().min(0);

// SHA256 hash
export const sha256HashSchema = z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid SHA256 hash');
