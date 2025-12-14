/**
 * Type definitions for standardized API responses
 */

export interface MetaResponse {
  timestamp: string;
  requestId: string;
  count?: number;
  total?: number;
  version?: string;
  duration?: number;
  cached?: boolean;
  message?: string;
}

export interface ErrorDetail {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: MetaResponse;
}

export interface ApiErrorResponse {
  errors: ErrorDetail[];
  meta: MetaResponse;
}

export interface CursorPagination {
  type: 'cursor';
  cursor: string;
  nextCursor: string | null;
  prevCursor: string | null;
  limit: number;
  hasMore: boolean;
}

export interface OffsetPagination {
  type: 'offset';
  offset: number;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface PaginationLinks {
  self: string;
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: MetaResponse;
  pagination: CursorPagination | OffsetPagination;
  links: PaginationLinks;
}
