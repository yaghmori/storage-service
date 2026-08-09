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
import { Response } from 'express';
import { ZodError } from 'zod';
import {
  clientIp,
  durationMs,
  exceptionLogLevel,
  isSecurityProbePath,
  requestPath,
  userAgent,
  type HttpRequestLike,
} from '../../../common/logging/http-log.utils';
import { ErrorCode } from '../response.schemas';
import {
  errors,
  fromHttpException,
  fromZodError,
  internalError,
  type ErrorResponse,
  type MetaOptions,
} from '../response.utils';

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

function httpExceptionMessage(
  exception: Pick<HttpException, 'getStatus' | 'getResponse' | 'message'>,
): string {
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

function requestContext(request: HttpRequestLike) {
  const path = requestPath(request);
  return {
    requestId: request.id || (request.headers?.['x-request-id'] as string | undefined),
    correlationId: request.correlationId,
    method: request.method,
    url: path,
    ip: clientIp(request),
    userAgent: userAgent(request),
    durationMs: durationMs(request),
    ...(isSecurityProbePath(path) ? { category: 'security_probe' as const } : {}),
  };
}

function logHttpException(
  logger: Logger,
  status: number,
  message: string,
  request: HttpRequestLike,
  err?: unknown,
  extra?: Record<string, unknown>,
) {
  const ctx = requestContext(request);
  const level = exceptionLogLevel(status, ctx.url);
  const payload = {
    msg: 'http_exception',
    statusCode: status,
    error: message,
    ...ctx,
    ...extra,
    ...(err instanceof Error
      ? {
          err: {
            type: err.name,
            message: err.message,
            ...(process.env.NODE_ENV !== 'production' && err.stack
              ? { stack: err.stack }
              : {}),
          },
        }
      : {}),
  };

  if (level === 'error') {
    logger.error(payload);
  } else if (level === 'warn') {
    logger.warn(payload);
  } else {
    logger.log(payload);
  }
}

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
    const request = ctx.getRequest<HttpRequestLike>();

    const metaOptions: MetaOptions = {
      requestId: request.id || (request.headers?.['x-request-id'] as string | undefined),
    };

    let errorResponse: ErrorResponse;
    let httpStatus: HttpStatus;

    if (exception instanceof ZodError) {
      errorResponse = fromZodError(exception, metaOptions);
      httpStatus = HttpStatus.BAD_REQUEST;
      logHttpException(this.logger, httpStatus, 'Validation error', request, exception, {
        msg: 'validation_error',
        issues: exception.issues,
      });
    } else if (exception instanceof HttpException || isHttpExceptionLike(exception)) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;

        if (Array.isArray(responseObj.message)) {
          const validationErrors = this.extractValidationErrors(responseObj.message);
          errorResponse = errors(validationErrors, metaOptions);
        } else {
          errorResponse = fromHttpException(
            status,
            (responseObj.message as string) || exception.message,
            responseObj.error ? { error: responseObj.error } : undefined,
            metaOptions,
          );
        }
      } else {
        errorResponse = fromHttpException(status, exception.message, undefined, metaOptions);
      }

      httpStatus = status;
      logHttpException(
        this.logger,
        status,
        httpExceptionMessage(exception),
        request,
        exception instanceof Error ? exception : undefined,
      );
    } else if (exception instanceof Error) {
      errorResponse = internalError(
        process.env['NODE_ENV'] === 'production' ? undefined : exception.message,
        metaOptions,
      );
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      logHttpException(this.logger, httpStatus, exception.message, request, exception, {
        msg: 'unhandled_error',
      });
    } else {
      errorResponse = internalError(undefined, metaOptions);
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      logHttpException(this.logger, httpStatus, 'Unknown exception', request, undefined, {
        msg: 'unknown_exception',
        detail: exception,
      });
    }

    response.status(httpStatus).json(errorResponse);
  }

  private extractValidationErrors(messages: unknown[]): Array<{
    code: ErrorCode | string;
    message: string;
    field?: string;
    constraint?: string;
  }> {
    return messages.flatMap((msg) => {
      if (typeof msg === 'string') {
        return [
          {
            code: ErrorCode.VALIDATION_ERROR,
            message: msg,
          },
        ];
      }

      if (msg && typeof msg === 'object' && 'constraints' in msg) {
        const validationMsg = msg as {
          constraints?: Record<string, string>;
          property?: string;
        };
        return Object.entries(validationMsg.constraints || {}).map(
          ([constraint, message]) => ({
            code: ErrorCode.VALIDATION_ERROR,
            message: message as string,
            field: validationMsg.property,
            constraint,
          }),
        );
      }

      if (msg && typeof msg === 'object' && 'field' in msg && 'message' in msg) {
        const custom = msg as { field: string; message: string; code?: string };
        return [
          {
            code: ErrorCode.VALIDATION_ERROR,
            message: custom.message,
            field: custom.field,
            constraint: custom.code,
          },
        ];
      }

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
    if (host.getType() !== 'rpc') {
      this.httpFilter.catch(exception, host);
      return;
    }

    const rpcData = host.getArgs()[0] as { requestId?: string } | undefined;
    const metaOptions: MetaOptions = {
      requestId: (host.getArgs()[1] as { requestId?: string } | undefined)?.requestId
        ?? rpcData?.requestId,
    };

    let errorResponse: ErrorResponse;

    if (exception instanceof ZodError) {
      this.logger.warn({
        msg: 'rpc_validation_error',
        requestId: metaOptions.requestId,
        issues: exception.issues,
      });
      errorResponse = fromZodError(exception, metaOptions);
    } else if (exception instanceof HttpException || isHttpExceptionLike(exception)) {
      const status = exception.getStatus();
      const message = httpExceptionMessage(exception);
      this.logger.warn({
        msg: 'rpc_http_exception',
        statusCode: status,
        requestId: metaOptions.requestId,
        error: message,
      });
      errorResponse = fromHttpException(status, message, undefined, metaOptions);
    } else if (exception instanceof Error) {
      this.logger.error({
        msg: 'rpc_unhandled_error',
        requestId: metaOptions.requestId,
        err: {
          type: exception.name,
          message: exception.message,
          ...(process.env.NODE_ENV !== 'production' && exception.stack
            ? { stack: exception.stack }
            : {}),
        },
      });
      errorResponse = internalError(
        process.env['NODE_ENV'] === 'production' ? undefined : exception.message,
        metaOptions,
      );
    } else {
      this.logger.error({
        msg: 'rpc_unknown_exception',
        requestId: metaOptions.requestId,
        detail: exception,
      });
      errorResponse = internalError(undefined, metaOptions);
    }

    throw new RpcException(errorResponse);
  }
}
