import type { Request } from 'express';
import type { Params } from 'nestjs-pino';
import {
  genReqId,
  isIgnoredAccessPath,
  resolveLogLevel,
  shouldUsePrettyLogs,
} from './http-log.utils';

export const SERVICE_NAME = 'storage-service';

export function buildLoggerModuleParams(): Params {
  const level = resolveLogLevel();
  const pretty = shouldUsePrettyLogs();

  return {
    pinoHttp: {
      level,
      name: SERVICE_NAME,
      genReqId,
      customProps: (req) => {
        const r = req as Request & {
          id?: string;
          correlationId?: string;
          tenantId?: string;
        };
        return {
          requestId: r.id,
          correlationId: r.correlationId,
          tenantId: r.tenantId,
          ip: r.ip,
        };
      },
      autoLogging: {
        ignore: (req) => isIgnoredAccessPath(req.url),
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
      formatters: {
        level: (label) => ({ level: label }),
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'body.password',
          'body.token',
          'body.secret',
          'body.apiKey',
          'body.refreshToken',
          'body.accessToken',
        ],
        remove: true,
      },
      transport: pretty
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          }
        : undefined,
    },
  };
}
