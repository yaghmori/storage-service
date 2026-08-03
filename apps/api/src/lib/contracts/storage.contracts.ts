import { z } from 'zod';
import {
  uuidSchema,
  nonEmptyStringSchema,
  mimeTypeSchema,
  fileSizeSchema,
  sha256HashSchema,
  dateStringSchema,
  urlSchema,
  dataObjectSchema,
} from './common.schemas';

/**
 * Storage Service Contracts
 * These schemas define the API contracts for file storage operations
 */

// ============================================================================
// Storage Provider Types
// ============================================================================

export const storageProviderTypeSchema = z.enum([
  'local',
  's3',
  'minio',
  'gcs',
  'azure',
  'cloudinary',
]);

export type StorageProviderType = z.infer<typeof storageProviderTypeSchema>;

// ============================================================================
// File Status
// ============================================================================

export const fileStatusSchema = z.enum([
  'uploading',
  'processing',
  'ready',
  'failed',
  'deleted',
]);

export type FileStatus = z.infer<typeof fileStatusSchema>;

// ============================================================================
// Files
// ============================================================================

export const createFileRequestSchema = z.object({
  storageProviderId: uuidSchema,
  key: nonEmptyStringSchema,
  originalFilename: nonEmptyStringSchema,
  mimeType: mimeTypeSchema,
  size: fileSizeSchema,
  sha256Hash: sha256HashSchema,
  metadata: dataObjectSchema.optional(),
});

export type CreateFileRequest = z.infer<typeof createFileRequestSchema>;

export const updateFileRequestSchema = z.object({
  originalFilename: nonEmptyStringSchema.optional(),
  referenceCount: z.number().int().min(0).optional(),
  metadata: dataObjectSchema.optional(),
  status: fileStatusSchema.optional(),
});

export type UpdateFileRequest = z.infer<typeof updateFileRequestSchema>;

export const fileResponseSchema = z.object({
  id: uuidSchema,
  storageProviderId: uuidSchema,
  key: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  sha256Hash: z.string(),
  status: fileStatusSchema,
  referenceCount: z.number().int(),
  metadata: dataObjectSchema.nullable(),
  uploadedBy: uuidSchema.nullable(),
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
  deletedAt: dateStringSchema.nullable(),
});

export type FileResponse = z.infer<typeof fileResponseSchema>;

// ============================================================================
// Storage Providers
// ============================================================================

export const storageProviderConfigSchema = z.record(z.string(), z.unknown());

export const createStorageProviderRequestSchema = z.object({
  name: nonEmptyStringSchema,
  type: storageProviderTypeSchema,
  config: storageProviderConfigSchema,
  isActive: z.boolean().default(true).optional(),
  isDefault: z.boolean().default(false).optional(),
});

export type CreateStorageProviderRequest = z.infer<typeof createStorageProviderRequestSchema>;

export const updateStorageProviderRequestSchema = z.object({
  name: nonEmptyStringSchema.optional(),
  config: storageProviderConfigSchema.optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateStorageProviderRequest = z.infer<typeof updateStorageProviderRequestSchema>;

export const storageProviderResponseSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  type: storageProviderTypeSchema,
  config: storageProviderConfigSchema,
  isActive: z.boolean(),
  isDefault: z.boolean(),
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
});

export type StorageProviderResponse = z.infer<typeof storageProviderResponseSchema>;

// ============================================================================
// Upload
// ============================================================================

export const uploadRequestSchema = z.object({
  filename: nonEmptyStringSchema,
  mimeType: mimeTypeSchema,
  size: fileSizeSchema,
  storageProviderId: uuidSchema.optional(),
  metadata: dataObjectSchema.optional(),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export const uploadResponseSchema = z.object({
  fileId: uuidSchema,
  uploadUrl: urlSchema,
  key: z.string(),
  expiresIn: z.number().int().positive(),
  fields: dataObjectSchema.optional(),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export const uploadCompleteRequestSchema = z.object({
  fileId: uuidSchema,
  sha256Hash: sha256HashSchema,
});

export type UploadCompleteRequest = z.infer<typeof uploadCompleteRequestSchema>;

export const uploadCompleteResponseSchema = z.object({
  file: fileResponseSchema,
  message: z.string().optional(),
});

export type UploadCompleteResponse = z.infer<typeof uploadCompleteResponseSchema>;

// ============================================================================
// Serving/Download
// ============================================================================

export const signedUrlRequestSchema = z.object({
  fileId: uuidSchema,
  expiresIn: z.number().int().positive().default(3600).optional(),
  download: z.boolean().default(false).optional(),
  filename: z.string().optional(),
});

export type SignedUrlRequest = z.infer<typeof signedUrlRequestSchema>;

export const signedUrlResponseSchema = z.object({
  url: urlSchema,
  expiresAt: dateStringSchema,
  expiresIn: z.number().int(),
});

export type SignedUrlResponse = z.infer<typeof signedUrlResponseSchema>;

// ============================================================================
// Processing
// ============================================================================

export const processingJobTypeSchema = z.enum([
  'thumbnail',
  'resize',
  'compress',
  'convert',
  'transcode',
  'extract-metadata',
]);

export type ProcessingJobType = z.infer<typeof processingJobTypeSchema>;

export const processingJobStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
]);

export type ProcessingJobStatus = z.infer<typeof processingJobStatusSchema>;

export const createProcessingJobRequestSchema = z.object({
  fileId: uuidSchema,
  type: processingJobTypeSchema,
  parameters: dataObjectSchema.optional(),
});

export type CreateProcessingJobRequest = z.infer<typeof createProcessingJobRequestSchema>;

export const processingJobResponseSchema = z.object({
  id: uuidSchema,
  fileId: uuidSchema,
  type: processingJobTypeSchema,
  status: processingJobStatusSchema,
  parameters: dataObjectSchema.nullable(),
  result: dataObjectSchema.nullable(),
  error: z.string().nullable(),
  startedAt: dateStringSchema.nullable(),
  completedAt: dateStringSchema.nullable(),
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
});

export type ProcessingJobResponse = z.infer<typeof processingJobResponseSchema>;

// ============================================================================
// Variants
// ============================================================================

export const createVariantRequestSchema = z.object({
  fileId: uuidSchema,
  name: nonEmptyStringSchema,
  key: nonEmptyStringSchema,
  mimeType: mimeTypeSchema,
  size: fileSizeSchema,
  metadata: dataObjectSchema.optional(),
});

export type CreateVariantRequest = z.infer<typeof createVariantRequestSchema>;

// ============================================================================
// File Operations
// ============================================================================

export const getFileInfoRequestSchema = z.object({
  id: uuidSchema,
});

export type GetFileInfoRequest = z.infer<typeof getFileInfoRequestSchema>;

export const deleteFileRequestSchema = z.object({
  id: uuidSchema,
  hardDelete: z.boolean().default(false).optional(),
});

export type DeleteFileRequest = z.infer<typeof deleteFileRequestSchema>;

// ============================================================================
// Batch Operations
// ============================================================================

export const batchOperationTypeSchema = z.enum(['get', 'delete']);

export type BatchOperationType = z.infer<typeof batchOperationTypeSchema>;

export const batchOperationSchema = z.object({
  type: batchOperationTypeSchema,
  id: uuidSchema,
  hardDelete: z.boolean().optional(),
});

export type BatchOperation = z.infer<typeof batchOperationSchema>;

export const batchOperationsRequestSchema = z.object({
  operations: z.array(batchOperationSchema).min(1, 'At least one operation required').max(100, 'Maximum 100 operations per batch'),
});

export type BatchOperationsRequest = z.infer<typeof batchOperationsRequestSchema>;

export const batchOperationResultSchema = z.union([
  fileResponseSchema,
  z.object({
    error: z.string(),
  }),
]);

export type BatchOperationResult = z.infer<typeof batchOperationResultSchema>;

export const batchOperationsResponseSchema = z.object({
  results: z.array(batchOperationResultSchema),
});

export type BatchOperationsResponse = z.infer<typeof batchOperationsResponseSchema>;

export const variantResponseSchema = z.object({
  id: uuidSchema,
  fileId: uuidSchema,
  name: z.string(),
  key: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  metadata: dataObjectSchema.nullable(),
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
});

export type VariantResponse = z.infer<typeof variantResponseSchema>;

// ============================================================================
// Analytics
// ============================================================================

export const storageAnalyticsResponseSchema = z.object({
  totalFiles: z.number().int().min(0),
  totalSize: z.number().int().min(0),
  totalSizeByProvider: z.record(z.string(), z.number().int()),
  totalFilesByMimeType: z.record(z.string(), z.number().int()),
  totalFilesByStatus: z.record(z.string(), z.number().int()),
});

export type StorageAnalyticsResponse = z.infer<typeof storageAnalyticsResponseSchema>;
