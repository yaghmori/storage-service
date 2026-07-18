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
 * Logs TCP/RPC microservice requests with a readable label (not `[object Object]`).
 */
@Injectable()
export class RpcLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RpcLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const label = this.describeRpcCall(context);

    this.logger.log(`Request: ${label}`);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`Response: ${label} (${Date.now() - startTime}ms)`);
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Error: ${label} (${Date.now() - startTime}ms) - ${message}`);
        },
      }),
    );
  }

  private describeRpcCall(context: ExecutionContext): string {
    const controller = context.getClass()?.name ?? 'UnknownController';
    const handler = context.getHandler()?.name ?? 'unknownHandler';
    const data = context.switchToRpc().getData() as Record<string, unknown> | undefined;
    const requestId =
      data && typeof data['requestId'] === 'string' ? data['requestId'] : undefined;

    const ctx = context.switchToRpc().getContext();
    const patternFromContext = this.extractPattern(ctx);

    const base = patternFromContext ?? `${controller}.${handler}`;
    return requestId ? `${base} [requestId=${requestId}]` : base;
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
