/**
 * Response Transformation Interceptor for NestJS
 *
 * Automatically wraps controller responses in standardized success format
 *
 * @module nestjs/response.interceptor
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { success, emptySuccess, type SuccessResponse, type MetaOptions } from '../response.utils';

/**
 * Custom decorator to mark routes that should skip response transformation
 *
 * @example
 * ```typescript
 * @Get('health')
 * @SkipResponseTransform()
 * health() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const SKIP_TRANSFORM_KEY = 'skipTransform';
export const SkipResponseTransform = () => {
  const { SetMetadata } = require('@nestjs/common');
  return SetMetadata(SKIP_TRANSFORM_KEY, true);
};

/**
 * Custom decorator to add custom metadata to responses
 *
 * @example
 * ```typescript
 * @Get('users')
 * @ResponseMeta({ cached: true, version: 'v2' })
 * getUsers() {
 *   return userService.findAll();
 * }
 * ```
 */
export const RESPONSE_META_KEY = 'responseMeta';
export const ResponseMeta = (meta: Partial<MetaOptions>) => {
  const { SetMetadata } = require('@nestjs/common');
  return SetMetadata(RESPONSE_META_KEY, meta);
};

/**
 * Interceptor that transforms all successful responses into standardized format
 *
 * @example
 * ```typescript
 * // In main.ts or module
 * app.useGlobalInterceptors(new ResponseTransformInterceptor(app.get(Reflector)));
 * ```
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T>> {
    // Only apply to HTTP contexts (not TCP/RPC/Kafka)
    if (context.getType() !== 'http') {
      return next.handle();
    }

    // Check if transformation should be skipped
    const skipTransform = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTransform) {
      return next.handle();
    }

    // Get custom response metadata from decorator
    const customMeta = this.reflector.getAllAndOverride<Partial<MetaOptions>>(RESPONSE_META_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Extract request information
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Build metadata
    const metaOptions: MetaOptions = {
      requestId: request.id || request.headers['x-request-id'],
      duration: undefined, // Will be set after response
      ...customMeta,
    };

    return next.handle().pipe(
      map((data) => {
        // Calculate response duration
        metaOptions.duration = Date.now() - startTime;

        // Handle null/undefined responses (e.g., DELETE operations)
        if (data === null || data === undefined) {
          // Set 204 No Content status
          response.status(HttpStatus.NO_CONTENT);
          // Empty responses are still valid success responses with null data
          return emptySuccess(metaOptions) as unknown as SuccessResponse<T>;
        }

        // Check if data is already in standardized format
        if (this.isStandardizedResponse(data)) {
          const standardized = {
            ...data,
            meta: {
              ...data.meta,
              duration: metaOptions.duration,
            },
          } as SuccessResponse<T>;

          return standardized;
        }

        // Transform raw data into standardized success response
        return success(data as T, metaOptions);
      }),
    );
  }

  /**
   * Checks if response is already in standardized format
   */
  private isStandardizedResponse(data: any): data is SuccessResponse<any> {
    return (
      data &&
      typeof data === 'object' &&
      'data' in data &&
      'meta' in data
    );
  }
}

/**
 * Logging interceptor for request/response tracking
 *
 * @example
 * ```typescript
 * app.useGlobalInterceptors(new LoggingInterceptor());
 * ```
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers } = request;
    const startTime = Date.now();

    const requestId = request.id || headers['x-request-id'] || 'unknown';

    console.log(`[${requestId}] --> ${method} ${url}`, {
      body: this.sanitizeBody(body),
      userAgent: headers['user-agent'],
    });

    return next.handle().pipe(
      map((data) => {
        const duration = Date.now() - startTime;
        const response = context.switchToHttp().getResponse();

        console.log(`[${requestId}] <-- ${method} ${url} ${response.statusCode} (${duration}ms)`);

        return data;
      }),
    );
  }

  /**
   * Removes sensitive fields from request body
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'refreshToken', 'accessToken'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

/**
 * Performance monitoring interceptor
 *
 * @example
 * ```typescript
 * app.useGlobalInterceptors(new PerformanceInterceptor(500)); // Warn if > 500ms
 * ```
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private readonly thresholdMs: number = 1000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        const duration = Date.now() - startTime;

        if (duration > this.thresholdMs) {
          console.warn(
            `⚠️ Slow request detected: ${request.method} ${request.url} took ${duration}ms`,
          );
        }

        return data;
      }),
    );
  }
}

/**
 * Cache header interceptor for GET requests
 *
 * @example
 * ```typescript
 * // In controller
 * @Get('public-data')
 * @CacheControl('public, max-age=3600')
 * getPublicData() {
 *   return this.service.getPublicData();
 * }
 * ```
 */
export const CACHE_CONTROL_KEY = 'cacheControl';
export const CacheControl = (value: string) => {
  const { SetMetadata } = require('@nestjs/common');
  return SetMetadata(CACHE_CONTROL_KEY, value);
};

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const cacheControl = this.reflector.get<string>(CACHE_CONTROL_KEY, context.getHandler());

    if (cacheControl) {
      const response = context.switchToHttp().getResponse();
      response.setHeader('Cache-Control', cacheControl);
    }

    return next.handle();
  }
}
