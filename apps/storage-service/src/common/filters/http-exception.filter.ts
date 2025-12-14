import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Request, Response } from 'express';
import type { ApiErrorResponse, ErrorDetail } from '../types/api-response.types';
import {
  buildBadRequestResponse,
  buildConflictResponse,
  buildErrorResponse,
  buildForbiddenResponse,
  buildNotFoundResponse,
  buildUnauthorizedResponse,
} from '../utils/response.util';

/**
 * Map HTTP status code to error code
 */
function getErrorCode(statusCode: number): string {
  const codeMap: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT',
  };
  return codeMap[statusCode] || 'ERROR';
}

/**
 * Extract error details from validation errors (class-validator)
 */
function extractValidationErrors(errors: ValidationError[]): ErrorDetail[] {
  const errorDetails: ErrorDetail[] = [];

  function extractError(error: ValidationError, parentPath = ''): void {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      Object.entries(error.constraints).forEach(([constraint, message]) => {
        errorDetails.push({
          code: constraint.toUpperCase().replace(/\s+/g, '_'),
          message,
          field: path,
          value: error.value,
        });
      });
    }

    if (error.children && error.children.length > 0) {
      error.children.forEach((child) => extractError(child, path));
    }
  }

  errors.forEach((error) => extractError(error));
  return errorDetails;
}

/**
 * Convert NestJS HttpException response to ErrorDetail[]
 */
function convertExceptionToErrorDetails(
  exception: HttpException
): ErrorDetail[] {
  const response = exception.getResponse();
  const statusCode = exception.getStatus();
  const errorCode = getErrorCode(statusCode);

  // Handle validation errors from class-validator
  if (
    exception instanceof BadRequestException &&
    typeof response === 'object' &&
    response !== null &&
    'message' in response
  ) {
    const message = (response as { message: unknown }).message;

    // Check if it's an array of ValidationError objects (NestJS default ValidationPipe)
    if (Array.isArray(message) && message.length > 0) {
      // Check if first item looks like a ValidationError
      const firstItem = message[0];
      if (
        typeof firstItem === 'object' &&
        firstItem !== null &&
        'property' in firstItem &&
        'constraints' in firstItem
      ) {
        return extractValidationErrors(message as ValidationError[]);
      }

      // Check if it's an array of strings (custom ValidationPipe format)
      if (message.every((msg) => typeof msg === 'string')) {
        // Split semicolon-separated messages (from custom ValidationPipe)
        const allMessages = (message as string[]).flatMap((msg) =>
          msg.split(';').map((m) => m.trim()).filter((m) => m.length > 0)
        );
        return allMessages.map((msg) => ({
          code: errorCode,
          message: msg,
        }));
      }
    }
  }

  // Handle string messages
  if (typeof response === 'string') {
    // Check if it contains semicolon-separated messages (from custom ValidationPipe)
    if (response.includes(';')) {
      return response
        .split(';')
        .map((msg) => msg.trim())
        .filter((msg) => msg.length > 0)
        .map((msg) => ({
          code: errorCode,
          message: msg,
        }));
    }
    return [
      {
        code: errorCode,
        message: response,
      },
    ];
  }

  // Handle object responses
  if (typeof response === 'object' && response !== null) {
    const responseObj = response as Record<string, unknown>;

    // If message is an array of strings, convert each to ErrorDetail
    if (
      'message' in responseObj &&
      Array.isArray(responseObj.message) &&
      responseObj.message.every((msg) => typeof msg === 'string')
    ) {
      // Handle semicolon-separated messages in array items
      const allMessages = (responseObj.message as string[]).flatMap((msg) =>
        msg.split(';').map((m) => m.trim()).filter((m) => m.length > 0)
      );
      return allMessages.map((msg) => ({
        code: errorCode,
        message: msg,
      }));
    }

    // If message is a string, check for semicolon separation
    if ('message' in responseObj && typeof responseObj.message === 'string') {
      const msg = responseObj.message as string;
      if (msg.includes(';')) {
        return msg
          .split(';')
          .map((m) => m.trim())
          .filter((m) => m.length > 0)
          .map((m) => ({
            code: errorCode,
            message: m,
          }));
      }
      return [
        {
          code: errorCode,
          message: msg,
        },
      ];
    }

    // Fallback: convert object to string
    return [
      {
        code: errorCode,
        message: JSON.stringify(responseObj),
      },
    ];
  }

  // Fallback
  return [
    {
      code: errorCode,
      message: String(response),
    },
  ];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorResponse: {
      statusCode: number;
      body: ApiErrorResponse;
    };

    if (exception instanceof HttpException) {
      // Convert HttpException to ErrorDetail[]
      const errorDetails = convertExceptionToErrorDetails(exception);

      // Use specific builders for common exceptions
      if (exception instanceof UnauthorizedException) {
        const response = exception.getResponse();
        const message =
          typeof response === 'string'
            ? response
            : typeof response === 'object' && response !== null && 'message' in response && typeof response.message === 'string'
              ? response.message
              : 'Unauthorized';
        errorResponse = buildUnauthorizedResponse(
          message,
          undefined,
          request.headers
        );
      } else if (exception instanceof ForbiddenException) {
        const response = exception.getResponse();
        const message =
          typeof response === 'string'
            ? response
            : typeof response === 'object' && response !== null && 'message' in response && typeof response.message === 'string'
              ? response.message
              : 'Forbidden';
        errorResponse = buildForbiddenResponse(
          message,
          undefined,
          request.headers
        );
      } else if (exception instanceof NotFoundException) {
        const response = exception.getResponse();
        const message =
          typeof response === 'string'
            ? response
            : typeof response === 'object' && response !== null && 'message' in response && typeof response.message === 'string'
              ? response.message
              : 'Not Found';
        errorResponse = buildNotFoundResponse(
          message,
          undefined,
          request.headers
        );
      } else if (exception instanceof ConflictException) {
        const response = exception.getResponse();
        const message =
          typeof response === 'string'
            ? response
            : typeof response === 'object' && response !== null && 'message' in response && typeof response.message === 'string'
              ? response.message
              : 'Conflict';
        errorResponse = buildConflictResponse(
          message,
          undefined,
          request.headers
        );
      } else if (exception instanceof BadRequestException) {
        errorResponse = buildBadRequestResponse(
          errorDetails,
          undefined,
          request.headers
        );
      } else {
        // Generic error response
        errorResponse = buildErrorResponse(
          errorDetails,
          status,
          undefined,
          request.headers
        );
      }
    } else {
      // Non-HttpException (unexpected errors)
      const errorDetails: ErrorDetail[] = [
        {
          code: 'INTERNAL_SERVER_ERROR',
          message:
            exception instanceof Error
              ? exception.message
              : 'Internal server error',
        },
      ];

      errorResponse = buildErrorResponse(
        errorDetails,
        status,
        undefined,
        request.headers
      );

      // Log unexpected errors with stack trace
      this.logger.error(
        `${request.method} ${request.url} - ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Log the error
    if (exception instanceof HttpException) {
      this.logger.error(
        `${request.method} ${request.url} - ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(errorResponse.statusCode).json(errorResponse.body);
  }
}

