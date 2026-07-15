import { SERVICE_PORTS } from '../lib/contracts';

/**
 * Resolve listen ports from env so published GHCR images can remap at runtime.
 *
 * | Env        | Meaning              | Default                            |
 * |------------|----------------------|------------------------------------|
 * | HOST       | HTTP bind address    | 0.0.0.0                            |
 * | PORT       | HTTP listen port     | 4000                               |
 * | TCP_HOST   | TCP bind address     | HOST or 0.0.0.0                    |
 * | TCP_PORT   | Nest TCP listen port | SERVICE_PORTS.STORAGE_SERVICE_TCP  |
 */
export function resolveListenPorts() {
  const httpHost = process.env.HOST || '0.0.0.0';
  const httpPort = parseInt(process.env.PORT || '4000', 10);
  const tcpHost = process.env.TCP_HOST || httpHost;
  const tcpPort = parseInt(
    process.env.TCP_PORT || String(SERVICE_PORTS.STORAGE_SERVICE_TCP),
    10,
  );

  if (Number.isNaN(httpPort) || httpPort <= 0) {
    throw new Error(`Invalid PORT=${process.env.PORT}`);
  }
  if (Number.isNaN(tcpPort) || tcpPort <= 0) {
    throw new Error(`Invalid TCP_PORT=${process.env.TCP_PORT}`);
  }

  return { httpHost, httpPort, tcpHost, tcpPort };
}
