import type {
    CursorPagination,
    OffsetPagination,
    PaginationLinks,
} from '../types/api-response.types';

/**
 * Parse pagination query parameters from request
 * Returns pagination type and normalized parameters
 */
export function parsePaginationQuery(
  query: Record<string, string | undefined>
): {
  type: 'cursor' | 'offset';
  cursor?: string;
  offset?: number;
  page?: number;
  limit: number;
} {
  // Normalize limit/size
  const limitParam = query.limit || query.size;
  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100)
    : 25;

  // Check if cursor-based pagination is requested
  if (query.cursor) {
    return {
      type: 'cursor',
      cursor: query.cursor,
      limit,
    };
  }

  // Otherwise, use offset-based pagination
  const offsetParam = query.offset;
  const pageParam = query.page;

  let offset: number;
  let page: number;

  if (offsetParam) {
    offset = Math.max(parseInt(offsetParam, 10), 0);
    page = Math.floor(offset / limit) + 1;
  } else if (pageParam) {
    page = Math.max(parseInt(pageParam, 10), 1);
    offset = (page - 1) * limit;
  } else {
    // Default to first page
    page = 1;
    offset = 0;
  }

  return {
    type: 'offset',
    offset,
    page,
    limit,
  };
}

/**
 * Calculate offset pagination metadata
 */
export function calculateOffsetPagination(
  page: number,
  limit: number,
  total: number
): OffsetPagination {
  const totalPages = Math.ceil(total / limit);

  return {
    type: 'offset',
    offset: (page - 1) * limit,
    limit,
    page,
    total,
    totalPages,
  };
}

/**
 * Build cursor pagination object
 */
export function calculateCursorPagination(
  cursor: string,
  limit: number,
  hasMore: boolean,
  nextCursor: string | null,
  prevCursor: string | null
): CursorPagination {
  return {
    type: 'cursor',
    cursor,
    nextCursor,
    prevCursor,
    limit,
    hasMore,
  };
}

/**
 * Encode cursor data to base64url string
 */
export function encodeCursor(data: Record<string, unknown>): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64url');
}

/**
 * Decode cursor token to data object
 */
export function decodeCursor(token: string): Record<string, unknown> {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf-8');
    return JSON.parse(json);
  } catch (error) {
    throw new Error('Invalid cursor token');
  }
}

/**
 * Helper to build URL with query parameters
 */
function buildUrl(
  baseUrl: string,
  existingQuery: Record<string, unknown>,
  pagination: CursorPagination | OffsetPagination
): string {
  const params = new URLSearchParams();

  // Preserve existing query params (except pagination params)
  Object.entries(existingQuery).forEach(([key, value]) => {
    if (!['cursor', 'offset', 'page', 'limit', 'size'].includes(key)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
  });

  // Add pagination params
  if (pagination.type === 'cursor') {
    if (pagination.cursor) {
      params.append('cursor', pagination.cursor);
    }
  } else {
    params.append('offset', String(pagination.offset));
    params.append('page', String(pagination.page));
  }

  params.append('limit', String(pagination.limit));

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Build HATEOAS pagination links
 */
export function buildPaginationLinks(
  baseUrl: string,
  existingQuery: Record<string, unknown>,
  pagination: CursorPagination | OffsetPagination
): PaginationLinks {
  const links: PaginationLinks = {
    self: buildUrl(baseUrl, existingQuery, pagination),
  };

  if (pagination.type === 'cursor') {
    if (pagination.nextCursor) {
      links.next = buildUrl(baseUrl, existingQuery, {
        ...pagination,
        cursor: pagination.nextCursor,
      });
    }
    if (pagination.prevCursor) {
      links.prev = buildUrl(baseUrl, existingQuery, {
        ...pagination,
        cursor: pagination.prevCursor,
      });
    }
  } else {
    // Offset-based pagination
    const { page, limit, totalPages } = pagination;

    if (page > 1) {
      links.prev = buildUrl(baseUrl, existingQuery, {
        ...pagination,
        page: page - 1,
        offset: (page - 2) * limit,
      });
    }

    if (page < totalPages) {
      links.next = buildUrl(baseUrl, existingQuery, {
        ...pagination,
        page: page + 1,
        offset: page * limit,
      });
    }

    links.first = buildUrl(baseUrl, existingQuery, {
      ...pagination,
      page: 1,
      offset: 0,
    });

    if (totalPages > 1) {
      links.last = buildUrl(baseUrl, existingQuery, {
        ...pagination,
        page: totalPages,
        offset: (totalPages - 1) * limit,
      });
    }
  }

  return links;
}

/**
 * Apply pagination to database query
 * Returns skip and take values for pagination (Drizzle ORM compatible)
 */
export function applyPagination(pagination: {
  type: 'cursor' | 'offset';
  limit: number;
  offset?: number;
}): { skip?: number; take: number } {
  if (pagination.type === 'offset' && pagination.offset !== undefined) {
    return {
      skip: pagination.offset,
      take: pagination.limit,
    };
  }

  // For cursor-based, we'll need to handle it differently
  // This is a simplified version - cursor pagination typically requires
  // filtering by the cursor field (e.g., id > cursorId)
  return {
    take: pagination.limit,
  };
}
