/**
 * Unified Response Schemas for All Microservices
 *
 * This module provides comprehensive Zod schemas for standardized API responses
 * across all services in the microservices architecture.
 *
 * @module response.schemas
 */

import { z } from 'zod';

// ============================================================================
// META INFORMATION SCHEMAS
// ============================================================================

/**
 * Standard metadata included in all API responses
 */
export const MetaResponseSchema = z.object({
  timestamp: z.string().datetime(),
  requestId: z.string().uuid(),
  version: z.string().optional(),
  duration: z.number().int().positive().optional().describe('Response time in milliseconds'),
  cached: z.boolean().optional(),
  message: z.string().optional(),
  count: z.number().int().nonnegative().optional().describe('Number of items in current response'),
  total: z.number().int().nonnegative().optional().describe('Total number of items available'),
});

export type MetaResponse = z.infer<typeof MetaResponseSchema>;

// ============================================================================
// ERROR SCHEMAS
// ============================================================================

/**
 * Standard error codes used across all services
 */
export enum ErrorCode {
  // Client Errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  GONE = 'GONE',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Server Errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',

  // Business Logic Errors
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  OPERATION_FAILED = 'OPERATION_FAILED',

  // Authentication & Authorization
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // External Service Errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Detailed error information with field-level granularity
 */
export const ErrorDetailSchema = z.object({
  code: z.nativeEnum(ErrorCode).or(z.string()),
  message: z.string(),
  field: z.string().optional().describe('The field that caused the error (for validation errors)'),
  value: z.unknown().optional().describe('The value that caused the error'),
  constraint: z.string().optional().describe('The validation constraint that failed'),
  details: z.record(z.string(), z.unknown()).optional().describe('Additional context-specific details'),
});

/** Explicit shape so `code` stays `string` for consumers (Zod 4 `z.infer` can widen unions to `unknown`). */
export type ErrorDetail = {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
  constraint?: string;
  details?: Record<string, unknown>;
};

/**
 * Validation error specific schema (extends ErrorDetail)
 */
export const ValidationErrorSchema = ErrorDetailSchema.extend({
  code: z.literal(ErrorCode.VALIDATION_ERROR),
  field: z.string(),
  constraint: z.string(),
});

export type ValidationError = ErrorDetail & {
  code: typeof ErrorCode.VALIDATION_ERROR;
  field: string;
  constraint: string;
};

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

/**
 * Cursor-based pagination (for large datasets, real-time data)
 */
export const CursorPaginationSchema = z.object({
  type: z.literal('cursor'),
  cursor: z.string(),
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
  limit: z.number().int().positive(),
  hasMore: z.boolean(),
});

export type CursorPagination = z.infer<typeof CursorPaginationSchema>;

/**
 * Offset-based pagination (for traditional page-based navigation)
 */
export const OffsetPaginationSchema = z.object({
  type: z.literal('offset'),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export type OffsetPagination = z.infer<typeof OffsetPaginationSchema>;

/**
 * Union of pagination types
 */
export const PaginationSchema = z.discriminatedUnion('type', [
  CursorPaginationSchema,
  OffsetPaginationSchema,
]);

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * HATEOAS-style pagination links
 */
export const PaginationLinksSchema = z.object({
  self: z.string().url(),
  first: z.string().url().optional(),
  prev: z.string().url().optional(),
  next: z.string().url().optional(),
  last: z.string().url().optional(),
});

export type PaginationLinks = z.infer<typeof PaginationLinksSchema>;

// ============================================================================
// SUCCESS RESPONSE SCHEMAS
// ============================================================================

/**
 * Standard success response wrapper
 * @template T - The type of data being returned
 */
export const createSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: MetaResponseSchema,
  });

export type SuccessResponse<T> = {
  data: T;
  meta: MetaResponse;
};

/**
 * Paginated success response
 * @template T - The type of items in the data array
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: MetaResponseSchema,
    pagination: PaginationSchema,
    links: PaginationLinksSchema,
  });

export type PaginatedResponse<T> = {
  data: T[];
  meta: MetaResponse;
  pagination: Pagination;
  links: PaginationLinks;
};

/**
 * Empty success response (for DELETE, void operations)
 */
export const EmptySuccessResponseSchema = z.object({
  data: z.null(),
  meta: MetaResponseSchema,
});

export type EmptySuccessResponse = z.infer<typeof EmptySuccessResponseSchema>;

// ============================================================================
// ERROR RESPONSE SCHEMAS
// ============================================================================

/**
 * Standard error response wrapper
 */
export const ErrorResponseSchema = z.object({
  errors: z.array(ErrorDetailSchema).min(1),
  meta: MetaResponseSchema,
});

/** Uses explicit `ErrorDetail` so gateway/clients get `errors[].code: string`. */
export type ErrorResponse = {
  errors: ErrorDetail[];
  meta: MetaResponse;
};

/**
 * Validation error response (specific type of error response)
 */
export const ValidationErrorResponseSchema = z.object({
  success: z.literal(false),
  errors: z.array(ValidationErrorSchema).min(1),
  meta: MetaResponseSchema,
});

export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;

// ============================================================================
// HTTP STATUS CODE MAPPING
// ============================================================================

/**
 * Maps error codes to appropriate HTTP status codes
 */
export const ERROR_CODE_TO_HTTP_STATUS: Record<ErrorCode, number> = {
  // 4xx Client Errors
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.GONE]: 410,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,

  // 5xx Server Errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
  [ErrorCode.BAD_GATEWAY]: 502,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.GATEWAY_TIMEOUT]: 504,

  // Business Logic Errors (mapped to 4xx/5xx based on context)
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
  [ErrorCode.DUPLICATE_ENTRY]: 409,
  [ErrorCode.RESOURCE_LOCKED]: 423,
  [ErrorCode.OPERATION_FAILED]: 500,

  // Authentication & Authorization
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.ACCOUNT_DISABLED]: 403,
  [ErrorCode.ACCOUNT_LOCKED]: 423,

  // External Service Errors
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.TIMEOUT_ERROR]: 504,
  [ErrorCode.NETWORK_ERROR]: 503,
};

/**
 * Maps HTTP status codes to default error codes
 */
export const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  410: ErrorCode.GONE,
  422: ErrorCode.UNPROCESSABLE_ENTITY,
  423: ErrorCode.RESOURCE_LOCKED,
  429: ErrorCode.TOO_MANY_REQUESTS,
  500: ErrorCode.INTERNAL_SERVER_ERROR,
  501: ErrorCode.NOT_IMPLEMENTED,
  502: ErrorCode.BAD_GATEWAY,
  503: ErrorCode.SERVICE_UNAVAILABLE,
  504: ErrorCode.GATEWAY_TIMEOUT,
};

// ============================================================================
// UNIFIED API RESPONSE TYPE
// ============================================================================

/**
 * Union type for all possible API responses
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Type guard to check if response is a success
 * Success responses have 'data'; error responses have 'errors'
 */
export function isSuccessResponse<T>(response: ApiResponse<T> | null | undefined): response is SuccessResponse<T> {
  return response != null && typeof response === 'object' && 'data' in response;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse<T>(response: ApiResponse<T>): response is ErrorResponse {
  return response != null && typeof response === 'object' && 'errors' in response && Array.isArray((response as ErrorResponse).errors);
}

// ============================================================================
// COMMON ERROR TEMPLATES
// ============================================================================

/**
 * Common error messages for consistent user experience
 */
export const ERROR_MESSAGES = {
  // Generic
  INTERNAL_ERROR: 'An internal server error occurred. Please try again later.',
  BAD_REQUEST: 'The request could not be understood or was missing required parameters.',

  // Authentication
  UNAUTHORIZED: 'Authentication is required to access this resource.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  TOKEN_INVALID: 'Invalid authentication token provided.',
  INVALID_CREDENTIALS: 'Invalid email or password.',

  // Authorization
  FORBIDDEN: 'You do not have permission to access this resource.',
  INSUFFICIENT_PERMISSIONS: 'You lack the required permissions to perform this action.',

  // Resource
  NOT_FOUND: 'The requested resource was not found.',
  ALREADY_EXISTS: 'A resource with these details already exists.',
  RESOURCE_LOCKED: 'This resource is currently locked and cannot be modified.',

  // Validation
  VALIDATION_FAILED: 'Validation failed for the provided data.',
  INVALID_FORMAT: 'The provided data format is invalid.',

  // Rate Limiting
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',

  // External Services
  EXTERNAL_SERVICE_ERROR: 'An error occurred while communicating with an external service.',
  TIMEOUT: 'The request timed out. Please try again.',

  // Operations
  OPERATION_FAILED: 'The operation could not be completed.',
  DUPLICATE_OPERATION: 'This operation has already been performed.',
} as const;
