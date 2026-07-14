/* AUTO-GENERATED from contracts.json - do not edit by hand. Run: pnpm run codegen */
export const PORTS = {
  tcp: 4002,
  http: 4000,
} as const;

export const INJECTION_TOKEN = "STORAGE_SERVICE" as const;

export const DOCKER_IMAGE = "ghcr.io/yaghmori/storage-service" as const;

export const SERVICE_NAME = "storage-service" as const;

export const PATTERNS = {
  GET_FILE_INFO: "storage.get_file_info",
  DELETE_FILE: "storage.delete_file",
  BATCH_OPERATIONS: "storage.batch_operations",
  GET_SIGNED_URL: "storage.get_signed_url",
  UPLOAD_FILE: "uploadFile",
  GET_ASSET_URL: "getAssetUrl",
  DELETE_ASSET: "deleteAsset",
  HEALTH_CHECK: "health.check",
} as const;

export const TOPICS = {
  FILE_UPLOADED: "file.uploaded",
  FILE_DELETED: "file.deleted",
  FILE_PROCESSED: "file.processed",
} as const;

export const EVENT_TYPES = {
  UPLOADED: "evt.storage.file.uploaded.v1",
  DELETED: "evt.storage.file.deleted.v1",
  PROCESSED: "evt.storage.file.processed.v1",
} as const;

export type StoragePattern = (typeof PATTERNS)[keyof typeof PATTERNS];
export type StorageTopic = (typeof TOPICS)[keyof typeof TOPICS];
export type StorageEventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const StorageService = {
  name: SERVICE_NAME,
  token: INJECTION_TOKEN,
  image: DOCKER_IMAGE,
  ports: PORTS,
  patterns: PATTERNS,
  topics: TOPICS,
  eventTypes: EVENT_TYPES,
} as const;
