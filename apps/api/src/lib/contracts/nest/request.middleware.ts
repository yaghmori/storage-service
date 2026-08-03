/**
 * Request Middleware for NestJS
 *
 * Provides request ID tracking and context management
 *
 * @module nestjs/request.middleware
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware that adds request ID to all incoming requests
 *
 * @example
 * ```typescript
 * // In app.module.ts
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(RequestIdMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Check if request ID already exists in headers
    const existingRequestId = req.headers['x-request-id'] as string;

    // Generate or use existing request ID
    const requestId = existingRequestId || randomUUID();

    // Attach to request object
    (req as any).id = requestId;

    // Set response header
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}

/**
 * Middleware that adds request timestamp for performance tracking
 *
 * @example
 * ```typescript
 * consumer.apply(RequestTimestampMiddleware).forRoutes('*');
 * ```
 */
@Injectable()
export class RequestTimestampMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    (req as any).startTime = Date.now();
    next();
  }
}

/**
 * Middleware that extracts and validates API version from headers
 *
 * @example
 * ```typescript
 * consumer.apply(ApiVersionMiddleware).forRoutes('*');
 * ```
 */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const apiVersion = req.headers['x-api-version'] as string;

    if (apiVersion) {
      (req as any).apiVersion = apiVersion;
    }

    next();
  }
}

/**
 * Middleware that extracts tenant ID from headers for multi-tenancy
 *
 * @example
 * ```typescript
 * consumer.apply(TenantMiddleware).forRoutes('*');
 * ```
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (tenantId) {
      (req as any).tenantId = tenantId;
    }

    next();
  }
}

/**
 * Middleware that adds correlation ID for distributed tracing
 *
 * @example
 * ```typescript
 * consumer.apply(CorrelationIdMiddleware).forRoutes('*');
 * ```
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();

    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    next();
  }
}

/**
 * Combined middleware that applies all common request enhancements
 *
 * @example
 * ```typescript
 * consumer.apply(RequestContextMiddleware).forRoutes('*');
 * ```
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Request ID
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    (req as any).id = requestId;
    res.setHeader('X-Request-Id', requestId);

    // Correlation ID
    const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    // Timestamp
    (req as any).startTime = Date.now();

    // API Version
    const apiVersion = req.headers['x-api-version'] as string;
    if (apiVersion) {
      (req as any).apiVersion = apiVersion;
    }

    // Tenant ID
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId) {
      (req as any).tenantId = tenantId;
    }

    next();
  }
}
