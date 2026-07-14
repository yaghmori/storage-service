import type { ClientProviderOptions } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { resolveTcpEndpoint, type ServiceEndpoint } from './config';
import { INJECTION_TOKEN } from './generated';

export type StorageTcpClientOptions = ServiceEndpoint & {
  name?: string | symbol;
};

export function storageTcpClient(options: StorageTcpClientOptions = {}): ClientProviderOptions {
  const { host, port } = resolveTcpEndpoint(options);
  return {
    name: options.name ?? INJECTION_TOKEN,
    transport: Transport.TCP,
    options: { host, port },
  };
}
