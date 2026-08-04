/* AUTO-GENERATED from contracts.json - do not edit by hand. Run: pnpm run codegen */
export const PORTS = {
  tcp: 6001,
  http: 6100,
} as const;

export const INJECTION_TOKEN = "STORAGE_SERVICE" as const;
export const DOCKER_IMAGE = "ghcr.io/yaghmori/storage-service" as const;
export const SERVICE_NAME = "storage-service" as const;

export const ENV_KEYS = {
  httpBaseUrl: "STORAGE_SERVICE_URL",
  host: "STORAGE_SERVICE_HOST",
  tcpPort: "STORAGE_SERVICE_TCP_PORT",
  httpPort: "STORAGE_SERVICE_HTTP_PORT",
} as const;
export const PATTERNS = {
  GET_FILE_INFO: "storage.get_file_info",
  DELETE_FILE: "storage.delete_file",
  BATCH_OPERATIONS: "storage.batch_operations",
  GET_SIGNED_URL: "storage.get_signed_url",
  LIST_PROCESSOR_RESULTS: "storage.list_processor_results",
  GET_PROCESSOR_RESULT: "storage.get_processor_result",
  GET_FILE_METADATA: "storage.get_file_metadata",
  LIST_VARIANTS: "storage.list_variants",
  UPLOAD_FILE: "uploadFile",
  GET_ASSET_URL: "getAssetUrl",
  DELETE_ASSET: "deleteAsset",
  HEALTH_CHECK: "health.check",
} as const;
export const HTTP_PATHS = {
  UPLOAD: "/upload",
  UPLOAD_INITIATE: "/upload/initiate",
  UPLOAD_COMPLETE: "/upload/complete",
  UPLOAD_ABORT: "/upload/abort",
  UPLOAD_MULTIPART_PART_URL: "/upload/multipart/part-url",
  UPLOAD_MULTIPART_INITIATE: "/upload/multipart/initiate",
  UPLOAD_MULTIPART_COMPLETE: "/upload/multipart/complete",
  UPLOAD_MULTIPART_ABORT: "/upload/multipart/abort",
  GET_FILE: "/files/{id}",
  DELETE_FILE: "/files/{id}",
  DOWNLOAD: "/files/{id}/download",
  SIGNED_URL: "/files/{id}/signed-url",
  METADATA: "/files/{id}/metadata",
  PROCESSOR_RESULTS: "/files/{id}/processor-results",
  PROCESSOR_RESULT: "/files/{id}/processor-results/{processorKey}",
  VARIANTS: "/files/{id}/variants",
  HEALTH: "/health",
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
export type StorageHttpPath = (typeof HTTP_PATHS)[keyof typeof HTTP_PATHS];

export const StorageService = {
  name: SERVICE_NAME,
  token: INJECTION_TOKEN,
  image: DOCKER_IMAGE,
  ports: PORTS,
  env: ENV_KEYS,
  patterns: PATTERNS,
  httpPaths: HTTP_PATHS,
  topics: TOPICS,
  eventTypes: EVENT_TYPES,
} as const;
