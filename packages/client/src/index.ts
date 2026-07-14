export {
  StorageService,
  PORTS,
  PATTERNS,
  HTTP_PATHS,
  TOPICS,
  EVENT_TYPES,
  ENV_KEYS,
  INJECTION_TOKEN,
  DOCKER_IMAGE,
  SERVICE_NAME,
} from './generated';
export type {
  StoragePattern,
  StorageTopic,
  StorageEventType,
  StorageHttpPath,
} from './generated';

export * from './schemas';
export {
  resolveHttpBaseUrl,
  resolveTcpEndpoint,
  joinUrl,
  fillPath,
} from './config';
export type { ServiceEndpoint } from './config';

export { buildAuthHeaders, AUTH_HEADERS } from './auth';
export type { ClientAuth } from './auth';

export { StorageHttpClient, createStorageHttpClient } from './http';
export type { StorageHttpClientOptions } from './http';

export { StorageKafka, resolveKafkaConnection } from './kafka';
export type { KafkaConnectionEnv } from './kafka';

export { storageTcpClient } from './nest';
export type { StorageTcpClientOptions } from './nest';
