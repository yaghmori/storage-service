import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type {
  ApiSuccessResponse,
  PaginatedResponse,
} from '../types/api-response.types';
import { buildNoContentResponse, buildSuccessResponse } from '../utils/response.util';

/**
 * Recursively converts BigInt values to numbers in an object
 * This is necessary because JSON.stringify() cannot serialize BigInt values
 */
function convertBigIntToNumber(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    // Convert BigInt to number (safe for values up to Number.MAX_SAFE_INTEGER)
    return Number(obj);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }

  if (typeof obj === 'object') {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value);
    }
    return converted;
  }

  return obj;
}

/**
 * Check if response is already a paginated response
 */
function isPaginatedResponse<T>(
  data: unknown
): data is PaginatedResponse<T> {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    'pagination' in obj &&
    'links' in obj &&
    'data' in obj &&
    Array.isArray(obj.data)
  );
}

/**
 * Check if response is already in the correct format
 */
function isFormattedResponse<T>(
  data: unknown
): data is ApiSuccessResponse<T> | PaginatedResponse<T> {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return 'meta' in obj && ('data' in obj || 'pagination' in obj);
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T> | PaginatedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<T> | PaginatedResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    const statusCode = response.statusCode;
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        const duration = Date.now() - startTime;
        // Handle 204 No Content - no data should be returned or only meta
        if (statusCode === HttpStatus.NO_CONTENT) {
          // If data is empty/null/undefined, return empty object
          if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
            return {} as ApiSuccessResponse<T>;
          }
          // If data has meta, return it
          if (data && typeof data === 'object' && 'meta' in data) {
            return buildNoContentResponse(
              (data as { meta?: unknown }).meta as any,
              request.headers
            ) as ApiSuccessResponse<T>;
          }
          return {} as ApiSuccessResponse<T>;
        }

        // If response is already formatted (has meta and data/pagination), return as-is
        if (isFormattedResponse<T>(data)) {
          // Still convert BigInts in case they're in the data
          return convertBigIntToNumber(data) as ApiSuccessResponse<T> | PaginatedResponse<T>;
        }

        // If response is already paginated, convert BigInts and return
        if (isPaginatedResponse<T>(data)) {
          return convertBigIntToNumber(data) as PaginatedResponse<T>;
        }

        // Convert BigInt values to numbers before serialization
        const convertedData = convertBigIntToNumber(data) as T;

        // Build standard success response with enhanced meta
        return buildSuccessResponse(
          convertedData,
          {
            duration,
            version: process.env.APP_VERSION || process.env.npm_package_version,
          },
          request.headers,
        );
      }),
    );
  }
}

