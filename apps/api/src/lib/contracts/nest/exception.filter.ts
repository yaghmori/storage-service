/**
 * Global HTTP Exception Filter for NestJS
 *
 * Catches all HTTP exceptions and formats them into standardized error responses
 *
 * @module nestjs/exception.filter
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

/**
 * Duck-typed check: `instanceof HttpException` fails when microservice and
 * shared-contracts resolve different copies of `@nestjs/common` (common with pnpm).
 */
function isHttpExceptionLike(
  exception: unknown,
): exception is Pick<HttpException, 'getStatus' | 'getResponse' | 'message'> {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }
  const ex = exception as Record<string, unknown>;
  return typeof ex['getStatus'] === 'function' && typeof ex['getResponse'] === 'function';
}

function httpExceptionMessage(exception: Pick<HttpException, 'getStatus' | 'getResponse' | 'message'>): string {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return body;
  }
  if (body && typeof body === 'object' && 'message' in body) {
    const msg = (body as { message: unknown }).message;
    if (Array.isArray(msg)) {
      return msg.join(', ');
    }
    if (typeof msg === 'string') {
      return msg;
    }
  }
  return exception.message;
}
import { Response } from 'express';
import { ZodError } from 'zod';
import { ErrorCode } from '../response.schemas';
import {
  errors,
  fromHttpException,
  fromZodError,
  internalError,
  type ErrorResponse,
  type MetaOptions
} from '../response.utils';

/**
 * Global exception filter that standardizes all error responses
 *
 * @example
 * ```typescript
 * // In main.ts or app.module.ts
 * app.useGlobalFilters(new GlobalExceptionFilter());
 * ```
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Extract request metadata
    const metaOptions: MetaOptions = {
      requestId: (request as any).id || (request.headers as any)['x-request-id'],
    };

    let errorResponse: ErrorResponse;
    let httpStatus: HttpStatus;

    // Handle different exception types
    if (exception instanceof ZodError) {
      // Zod validation errors
      errorResponse = fromZodError(exception, metaOptions);
      httpStatus = HttpStatus.BAD_REQUEST;
      this.logger.warn(`Validation error: ${JSON.stringify(exception.issues)}`);
    } else if (exception instanceof HttpException || isHttpExceptionLike(exception)) {
      // NestJS HTTP exceptions
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;

        // Handle validation errors from class-validator
        if (Array.isArray(responseObj.message)) {
          const validationErrors = this.extractValidationErrors(responseObj.message);
          errorResponse = errors(validationErrors, metaOptions);
        } else {
          errorResponse = fromHttpException(
            status,
            responseObj.message || exception.message,
            responseObj.error ? { error: responseObj.error } : undefined,
            metaOptions,
          );
        }
      } else {
        errorResponse = fromHttpException(status, exception.message, undefined, metaOptions);
      }

      httpStatus = status;
      this.logger.warn(`HTTP exception [${status}]: ${exception.message}`);
    } else if (exception instanceof Error) {
      // Standard JavaScript errors
      errorResponse = internalError(
        process.env['NODE_ENV'] === 'production' ? undefined : exception.message,
        metaOptions,
      );
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    } else {
      // Unknown exceptions
      errorResponse = internalError(undefined, metaOptions);
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    // Send standardized error response
    response.status(httpStatus).json(errorResponse);
  }

  /**
   * Extracts validation errors from class-validator format
   */
  private extractValidationErrors(messages: any[]): Array<{
    code: ErrorCode | string;
    message: string;
    field?: string;
    constraint?: string;
  }> {
    return messages.flatMap((msg) => {
      // Handle string messages
      if (typeof msg === 'string') {
        return [
          {
            code: ErrorCode.VALIDATION_ERROR,
            message: msg,
          },
        ];
      }

      // Handle ValidationError objects from class-validator
      if (msg.constraints) {
        return Object.entries(msg.constraints).map(([constraint, message]) => ({
          code: ErrorCode.VALIDATION_ERROR,
          message: message as string,
          field: msg.property,
          constraint,
        }));
      }

      // Handle custom error format
      if (msg.field && msg.message) {
        return [
          {
            code: ErrorCode.VALIDATION_ERROR,
            message: msg.message,
            field: msg.field,
            constraint: msg.code,
          },
        ];
      }

      // Fallback
      return [
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: JSON.stringify(msg),
        },
      ];
    });
  }
}

/**
 * Microservice-specific exception filter for RPC/Kafka contexts
 *
 * @example
 * ```typescript
 * // In microservice main.ts
 * app.useGlobalFilters(new MicroserviceExceptionFilter());
 * ```
 */
@Catch()
export class MicroserviceExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MicroserviceExceptionFilter.name);
  private readonly httpFilter = new GlobalExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost): void {
    // Hybrid HTTP+TCP apps register this as APP_FILTER for both transports.
    // Never wrap HTTP errors in RpcException — that becomes Express "Error: Rpc Exception" HTML.
    if (host.getType() !== 'rpc') {
      this.httpFilter.catch(exception, host);
      return;
    }

    const metaOptions: MetaOptions = {
      requestId: (host.getArgs()[1] as { requestId?: string } | undefined)?.requestId,
    };

    let errorResponse: ErrorResponse;

    if (exception instanceof ZodError) {
      this.logger.warn(`Validation error in microservice: ${JSON.stringify(exception.issues)}`);
      errorResponse = fromZodError(exception, metaOptions);
    } else if (exception instanceof HttpException || isHttpExceptionLike(exception)) {
      const status = exception.getStatus();
      const message = httpExceptionMessage(exception);
      this.logger.warn(`HTTP exception in microservice [${status}]: ${message}`);
      errorResponse = fromHttpException(status, message, undefined, metaOptions);
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error in microservice: ${exception.message}`, exception.stack);
      errorResponse = internalError(
        process.env['NODE_ENV'] === 'production' ? undefined : exception.message,
        metaOptions,
      );
    } else {
      this.logger.error(`Unknown exception in microservice: ${JSON.stringify(exception)}`);
      errorResponse = internalError(undefined, metaOptions);
    }

    // RpcException ensures the standardized ErrorResponse crosses the TCP boundary.
    throw new RpcException(errorResponse);
  }
}
