import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs TCP/RPC microservice requests with structured fields for Loki/ELK.
 */
@Injectable()
export class RpcLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RpcLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const startTime = Date.now();
    const meta = this.describeRpcCall(context);

    this.logger.log({
      msg: 'rpc_request',
      ...meta,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log({
            msg: 'rpc_response',
            ...meta,
            durationMs: Date.now() - startTime,
          });
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error({
            msg: 'rpc_error',
            ...meta,
            durationMs: Date.now() - startTime,
            error: message,
            ...(error instanceof Error
              ? { err: { type: error.name, message: error.message } }
              : {}),
          });
        },
      }),
    );
  }

  private describeRpcCall(context: ExecutionContext): {
    pattern: string;
    controller: string;
    handler: string;
    requestId?: string;
  } {
    const controller = context.getClass()?.name ?? 'UnknownController';
    const handler = context.getHandler()?.name ?? 'unknownHandler';
    const data = context.switchToRpc().getData() as Record<string, unknown> | undefined;
    const requestId =
      data && typeof data['requestId'] === 'string' ? data['requestId'] : undefined;

    const ctx = context.switchToRpc().getContext();
    const patternFromContext = this.extractPattern(ctx);
    const pattern = patternFromContext ?? `${controller}.${handler}`;

    return { pattern, controller, handler, requestId };
  }

  private extractPattern(ctx: unknown): string | undefined {
    if (typeof ctx === 'string' && ctx.trim()) {
      return ctx;
    }

    if (!ctx || typeof ctx !== 'object') {
      return undefined;
    }

    const record = ctx as Record<string, unknown>;

    if (typeof record['pattern'] === 'string' && record['pattern'].trim()) {
      return record['pattern'];
    }

    if (typeof record['getPattern'] === 'function') {
      const pattern = (record['getPattern'] as () => unknown)();
      if (typeof pattern === 'string' && pattern.trim()) {
        return pattern;
      }
    }

    return undefined;
  }
}
