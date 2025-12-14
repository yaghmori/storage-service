import type {
    ApiErrorResponse,
    ApiSuccessResponse,
    CursorPagination,
    ErrorDetail,
    MetaResponse,
    OffsetPagination,
    PaginatedResponse,
    PaginationLinks,
} from '../types/api-response.types';
import { createMeta } from './meta.util';

/**
 * Response utility helpers for consistent API responses.
 * These are adapted for NestJS and work with Express Request headers.
 */

export function buildSuccessResponse<T>(
  data: T,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): ApiSuccessResponse<T> {
  const baseMeta =
    (meta as MetaResponse | undefined) ?? createMeta(headers);
  return {
    data,
    meta: baseMeta,
  };
}

export function buildCreatedResponse<T>(
  data: T,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): ApiSuccessResponse<T> {
  return buildSuccessResponse(data, meta, headers);
}

export function buildAcceptedResponse<T>(
  data: T,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): ApiSuccessResponse<T> {
  return buildSuccessResponse(data, meta, headers);
}

export function buildNoContentResponse(
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): { meta?: MetaResponse } {
  if (!meta) {
    return {};
  }
  const baseMeta = (meta as MetaResponse) ?? createMeta(headers);
  return { meta: baseMeta };
}

export function buildPaginatedResponse<T>(
  items: T[],
  pagination: CursorPagination | OffsetPagination,
  links: PaginationLinks,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): PaginatedResponse<T> {
  const responseMeta =
    (meta as MetaResponse | undefined) ?? createMeta(headers);

  if (responseMeta.count === undefined) {
    responseMeta.count = items.length;
  }

  // If total is not explicitly provided in meta, try to derive it from pagination
  if (responseMeta.total === undefined && pagination.type === 'offset') {
    // OffsetPagination now carries the total item count
    responseMeta.total = pagination.total;
  }

  return {
    data: items,
    meta: responseMeta,
    pagination,
    links,
  };
}

export function buildErrorResponse(
  errors: ErrorDetail[] | ErrorDetail | string,
  statusCode: number,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): { statusCode: number; body: ApiErrorResponse } {
  const responseMeta =
    (meta as MetaResponse | undefined) ?? createMeta(headers);

  let errorDetails: ErrorDetail[];
  if (typeof errors === 'string') {
    errorDetails = [
      {
        code: 'ERROR',
        message: errors,
      },
    ];
  } else if (Array.isArray(errors)) {
    errorDetails = errors;
  } else {
    errorDetails = [errors];
  }

  const body: ApiErrorResponse = {
    errors: errorDetails,
    meta: responseMeta,
  };

  return { statusCode, body };
}

export function buildBadRequestResponse(
  errors: ErrorDetail[] | ErrorDetail | string,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): { statusCode: number; body: ApiErrorResponse } {
  return buildErrorResponse(errors, 400, meta, headers);
}

export function buildUnauthorizedResponse(
  message: string,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): { statusCode: number; body: ApiErrorResponse } {
  return buildErrorResponse(
    {
      code: 'UNAUTHORIZED',
      message,
    },
    401,
    meta,
    headers
  );
}

export function buildForbiddenResponse(
  message: string,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): { statusCode: number; body: ApiErrorResponse } {
  return buildErrorResponse(
    {
      code: 'FORBIDDEN',
      message,
    },
    403,
    meta,
    headers
  );
}

export function buildNotFoundResponse(
  message: string,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): { statusCode: number; body: ApiErrorResponse } {
  return buildErrorResponse(
    {
      code: 'NOT_FOUND',
      message,
    },
    404,
    meta,
    headers
  );
}

export function buildConflictResponse(
  message: string,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): { statusCode: number; body: ApiErrorResponse } {
  return buildErrorResponse(
    {
      code: 'CONFLICT',
      message,
    },
    409,
    meta,
    headers
  );
}

export function buildTooManyRequestsResponse(
  message: string,
  meta: Partial<MetaResponse> | undefined,
  headers: Record<string, unknown>
): { statusCode: number; body: ApiErrorResponse } {
  return buildErrorResponse(
    {
      code: 'TOO_MANY_REQUESTS',
      message,
    },
    429,
    meta,
    headers
  );
}
