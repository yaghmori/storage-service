import type { ClientProviderOptions } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { INJECTION_TOKEN, PORTS, StorageService } from './generated';

export type StorageTcpClientOptions = {
  host?: string;
  port?: number;
  name?: string | symbol;
};

export function storageTcpClient(options: StorageTcpClientOptions = {}): ClientProviderOptions {
  const host =
    options.host ??
    process.env.STORAGE_SERVICE_HOST ??
    process.env.STORAGE_HOST ??
    '127.0.0.1';
  const port = Number(
    options.port ??
      process.env.STORAGE_SERVICE_TCP_PORT ??
      process.env.STORAGE_TCP_PORT ??
      PORTS.tcp,
  );

  return {
    name: options.name ?? INJECTION_TOKEN,
    transport: Transport.TCP,
    options: { host, port },
  };
}

export { StorageService, INJECTION_TOKEN, PORTS };
