/**
 * Unified Response Utilities
 *
 * Provides helper functions to build standardized API responses
 * across all microservices.
 *
 * @module response.utils
 */

import { randomUUID } from 'crypto';
import { ZodError } from 'zod';
import type {
  CursorPagination,
  EmptySuccessResponse,
  ErrorDetail,
  ErrorResponse,
  MetaResponse,
  OffsetPagination,
  PaginatedResponse,
  PaginationLinks,
  SuccessResponse,
  ValidationError,
} from './response.schemas';
import { ERROR_CODE_TO_HTTP_STATUS, ERROR_MESSAGES, ErrorCode, HTTP_STATUS_TO_ERROR_CODE } from './response.schemas';

// ============================================================================
// META BUILDER
// ============================================================================

export interface MetaOptions {
  requestId?: string;
  version?: string;
  duration?: number;
  cached?: boolean;
  message?: string;
  count?: number;
  total?: number;
}

/**
 * Creates standard metadata for responses
 */
export function buildMeta(options: MetaOptions = {}): MetaResponse {
  return {
    timestamp: new Date().toISOString(),
    requestId: options.requestId ?? randomUUID(),
    ...(options.version && { version: options.version }),
    ...(options.duration !== undefined && { duration: options.duration }),
    ...(options.cached !== undefined && { cached: options.cached }),
    ...(options.message && { message: options.message }),
    ...(options.count !== undefined && { count: options.count }),
    ...(options.total !== undefined && { total: options.total }),
  };
}

// ============================================================================
// SUCCESS RESPONSE BUILDERS
// ============================================================================

/**
 * Creates a standard success response
 *
 * @example
 * ```typescript
 * const user = { id: '123', email: 'user@example.com' };
 * return success(user, { message: 'User retrieved successfully' });
 * ```
 */
export function success<T>(data: T, metaOptions?: MetaOptions): SuccessResponse<T> {
  return {
    data,
    meta: buildMeta(metaOptions),
  };
}

/**
 * Creates an empty success response (for void operations)
 *
 * @example
 * ```typescript
 * await deleteUser(userId);
 * return emptySuccess({ message: 'User deleted successfully' });
 * ```
 */
export function emptySuccess(metaOptions?: MetaOptions): EmptySuccessResponse {
  return {
    data: null,
    meta: buildMeta(metaOptions),
  };
}

/**
 * Creates a paginated success response
 *
 * @example
 * ```typescript
 * const users = await getUsersPaginated(page, limit);
 * return paginated(users.items, {
 *   type: 'offset',
 *   offset: (page - 1) * limit,
 *   limit,
 *   page,
 *   total: users.total,
 *   totalPages: Math.ceil(users.total / limit),
 *   hasNext: page < Math.ceil(users.total / limit),
 *   hasPrev: page > 1,
 * }, {
 *   self: `/api/users?page=${page}&limit=${limit}`,
 *   next: page < Math.ceil(users.total / limit) ? `/api/users?page=${page + 1}&limit=${limit}` : undefined,
 *   prev: page > 1 ? `/api/users?page=${page - 1}&limit=${limit}` : undefined,
 * });
 * ```
 */
export function paginated<T>(
  data: T[],
  pagination: CursorPagination | OffsetPagination,
  links: PaginationLinks,
  metaOptions?: MetaOptions,
): PaginatedResponse<T> {
  return {
    data,
    meta: buildMeta({
      ...metaOptions,
      count: data.length,
      total: pagination.type === 'offset' ? pagination.total : undefined,
    }),
    pagination,
    links,
  };
}

// ============================================================================
// ERROR RESPONSE BUILDERS
// ============================================================================

/**
 * Creates a standard error response
 *
 * @example
 * ```typescript
 * return error(ErrorCode.NOT_FOUND, 'User not found', { userId });
 * ```
 */
export function error(
  code: ErrorCode | string,
  message: string,
  details?: Record<string, unknown>,
  metaOptions?: MetaOptions,
): ErrorResponse {
  const errorDetail: ErrorDetail = {
    code,
    message,
    ...(details && { details }),
  };

  return {
    errors: [errorDetail],
    meta: buildMeta(metaOptions),
  };
}

/**
 * Creates an error response with multiple errors
 *
 * @example
 * ```typescript
 * return errors([
 *   { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid email', field: 'email' },
 *   { code: ErrorCode.VALIDATION_ERROR, message: 'Password too short', field: 'password' },
 * ]);
 * ```
 */
export function errors(errorDetails: ErrorDetail[], metaOptions?: MetaOptions): ErrorResponse {
  return {
    errors: errorDetails,
    meta: buildMeta(metaOptions),
  };
}

/**
 * Creates a validation error response
 *
 * @example
 * ```typescript
 * return validationError('email', 'Invalid email format', 'user@invalid');
 * ```
 */
export function validationError(
  field: string,
  message: string,
  value?: unknown,
  constraint?: string,
  metaOptions?: MetaOptions,
): ErrorResponse {
  const validationErr: ValidationError = {
    code: ErrorCode.VALIDATION_ERROR,
    message,
    field,
    constraint: constraint || 'invalid',
    ...(value !== undefined && { value }),
  };

  return {
    errors: [validationErr],
    meta: buildMeta(metaOptions),
  };
}

/**
 * Creates a validation error response from multiple field errors
 *
 * @example
 * ```typescript
 * return validationErrors([
 *   { field: 'email', message: 'Invalid email', constraint: 'email' },
 *   { field: 'password', message: 'Too short', constraint: 'minLength' },
 * ]);
 * ```
 */
export function validationErrors(
  fieldErrors: Array<{ field: string; message: string; value?: unknown; constraint?: string }>,
  metaOptions?: MetaOptions,
): ErrorResponse {
  const validationErrs: ValidationError[] = fieldErrors.map((err) => ({
    code: ErrorCode.VALIDATION_ERROR,
    message: err.message,
    field: err.field,
    constraint: err.constraint || 'invalid',
    ...(err.value !== undefined && { value: err.value }),
  }));

  return {
    errors: validationErrs,
    meta: buildMeta(metaOptions),
  };
}

// ============================================================================
// ZOD ERROR HANDLER
// ============================================================================

/**
 * Converts Zod validation errors to standardized validation error response
 *
 * @example
 * ```typescript
 * const result = LoginSchema.safeParse(body);
 * if (!result.success) {
 *   return fromZodError(result.error);
 * }
 * ```
 */
export function fromZodError(zodError: ZodError, metaOptions?: MetaOptions): ErrorResponse {
  const fieldErrors = zodError.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    value: err.code === 'invalid_type' ? undefined : (err as any).input,
    constraint: err.code,
  }));

  return validationErrors(fieldErrors, metaOptions);
}

// ============================================================================
// HTTP STATUS ERROR BUILDERS
// ============================================================================

/**
 * Creates a 400 Bad Request error response
 */
export function badRequest(message: string = ERROR_MESSAGES.BAD_REQUEST, metaOptions?: MetaOptions): ErrorResponse {
  return error(ErrorCode.BAD_REQUEST, message, undefined, metaOptions);
}

/**
 * Creates a 401 Unauthorized error response
 */
export function unauthorized(
  message: string = ERROR_MESSAGES.UNAUTHORIZED,
  metaOptions?: MetaOptions,
): ErrorResponse {
  return error(ErrorCode.UNAUTHORIZED, message, undefined, metaOptions);
}

/**
 * Creates a 403 Forbidden error response
 */
export function forbidden(message: string = ERROR_MESSAGES.FORBIDDEN, metaOptions?: MetaOptions): ErrorResponse {
  return error(ErrorCode.FORBIDDEN, message, undefined, metaOptions);
}

/**
 * Creates a 404 Not Found error response
 */
export function notFound(message: string = ERROR_MESSAGES.NOT_FOUND, metaOptions?: MetaOptions): ErrorResponse {
  return error(ErrorCode.NOT_FOUND, message, undefined, metaOptions);
}

/**
 * Creates a 409 Conflict error response
 */
export function conflict(message: string = ERROR_MESSAGES.ALREADY_EXISTS, metaOptions?: MetaOptions): ErrorResponse {
  return error(ErrorCode.CONFLICT, message, undefined, metaOptions);
}

/**
 * Creates a 422 Unprocessable Entity error response
 */
export function unprocessableEntity(
  message: string = ERROR_MESSAGES.VALIDATION_FAILED,
  metaOptions?: MetaOptions,
): ErrorResponse {
  return error(ErrorCode.UNPROCESSABLE_ENTITY, message, undefined, metaOptions);
}

/**
 * Creates a 429 Too Many Requests error response
 */
export function tooManyRequests(
  message: string = ERROR_MESSAGES.TOO_MANY_REQUESTS,
  metaOptions?: MetaOptions,
): ErrorResponse {
  return error(ErrorCode.TOO_MANY_REQUESTS, message, undefined, metaOptions);
}

/**
 * Creates a 500 Internal Server Error response
 */
export function internalError(
  message: string = ERROR_MESSAGES.INTERNAL_ERROR,
  metaOptions?: MetaOptions,
): ErrorResponse {
  return error(ErrorCode.INTERNAL_SERVER_ERROR, message, undefined, metaOptions);
}

/**
 * Creates a 503 Service Unavailable error response
 */
export function serviceUnavailable(message?: string, metaOptions?: MetaOptions): ErrorResponse {
  return error(ErrorCode.SERVICE_UNAVAILABLE, message ?? 'Service temporarily unavailable', undefined, metaOptions);
}

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

export interface OffsetPaginationParams {
  page: number;
  limit: number;
  total: number;
}

/**
 * Builds offset-based pagination metadata
 */
export function buildOffsetPagination(params: OffsetPaginationParams): OffsetPagination {
  const { page, limit, total } = params;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  return {
    type: 'offset',
    offset,
    limit,
    page,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export interface CursorPaginationParams {
  cursor: string;
  limit: number;
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

/**
 * Builds cursor-based pagination metadata
 */
export function buildCursorPagination(params: CursorPaginationParams): CursorPagination {
  return {
    type: 'cursor',
    cursor: params.cursor,
    nextCursor: params.nextCursor,
    prevCursor: params.prevCursor,
    limit: params.limit,
    hasMore: params.hasMore,
  };
}

export interface PaginationLinksParams {
  baseUrl: string;
  page?: number;
  limit?: number;
  totalPages?: number;
  cursor?: string;
  nextCursor?: string | null;
  prevCursor?: string | null;
}

/**
 * Builds HATEOAS pagination links
 */
export function buildPaginationLinks(params: PaginationLinksParams): PaginationLinks {
  const { baseUrl, page, limit, totalPages, cursor, nextCursor, prevCursor } = params;

  // For cursor-based pagination
  if (cursor !== undefined) {
    return {
      self: `${baseUrl}?cursor=${cursor}&limit=${limit}`,
      ...(nextCursor && { next: `${baseUrl}?cursor=${nextCursor}&limit=${limit}` }),
      ...(prevCursor && { prev: `${baseUrl}?cursor=${prevCursor}&limit=${limit}` }),
    };
  }

  // For offset-based pagination
  if (page !== undefined && limit !== undefined) {
    return {
      self: `${baseUrl}?page=${page}&limit=${limit}`,
      first: `${baseUrl}?page=1&limit=${limit}`,
      ...(page > 1 && { prev: `${baseUrl}?page=${page - 1}&limit=${limit}` }),
      ...(totalPages && page < totalPages && { next: `${baseUrl}?page=${page + 1}&limit=${limit}` }),
      ...(totalPages && { last: `${baseUrl}?page=${totalPages}&limit=${limit}` }),
    };
  }

  return { self: baseUrl };
}

// ============================================================================
// EXCEPTION MAPPER
// ============================================================================

/**
 * Maps HTTP exception to standardized error response
 *
 * @example
 * ```typescript
 * try {
 *   // ...
 * } catch (err) {
 *   if (err instanceof HttpException) {
 *     return fromHttpException(err);
 *   }
 * }
 * ```
 */
export function fromHttpException(
  statusCode: number,
  message?: string,
  details?: Record<string, unknown>,
  metaOptions?: MetaOptions,
): ErrorResponse {
  const errorCode = HTTP_STATUS_TO_ERROR_CODE[statusCode] || ErrorCode.INTERNAL_SERVER_ERROR;
  const errorMessage = message || ERROR_MESSAGES.INTERNAL_ERROR;

  return error(errorCode, errorMessage, details, metaOptions);
}

// ============================================================================
// TYPE EXPORTS FOR CONVENIENCE
// ============================================================================

export type {
  CursorPagination, EmptySuccessResponse, ErrorDetail, ErrorResponse, MetaResponse, OffsetPagination, PaginatedResponse, PaginationLinks, SuccessResponse, ValidationError
};

  export { ERROR_CODE_TO_HTTP_STATUS, ERROR_MESSAGES, ErrorCode, HTTP_STATUS_TO_ERROR_CODE };
