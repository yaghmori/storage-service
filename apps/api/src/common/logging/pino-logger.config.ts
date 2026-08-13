import type { Request } from 'express';
import type { Params } from 'nestjs-pino';
import {
  genReqId,
  isIgnoredAccessPath,
  resolveLogLevel,
  shouldUsePrettyLogs,
} from './http-log.utils';

export const SERVICE_NAME = 'storage-service';

/** Align with Parslinks @org/shared-logger / email-service field schema. */
const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'body.password',
  'body.token',
  'body.secret',
  'body.apiKey',
  'body.refreshToken',
  'body.accessToken',
  'body.temporaryPassword',
  'body.otp',
  'body.otpToken',
  'body.code',
];

export function buildLoggerModuleParams(): Params {
  const level = resolveLogLevel();
  const pretty = shouldUsePrettyLogs();

  return {
    pinoHttp: {
      level,
      name: SERVICE_NAME,
      genReqId,
      mixin: () => ({
        service: SERVICE_NAME,
      }),
      customProps: (req) => {
        const r = req as Request & {
          id?: string;
          correlationId?: string;
          orgId?: string;
          tenantId?: string;
        };
        return {
          requestId: r.id,
          correlationId: r.correlationId,
          orgId: r.orgId ?? r.tenantId,
          ip: r.ip,
          service: SERVICE_NAME,
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
        paths: [...LOG_REDACT_PATHS],
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
