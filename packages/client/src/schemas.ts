import { z } from 'zod';

const uuidSchema = z.string().uuid();
const nonEmptyStringSchema = z.string().min(1);

export const getFileInfoRequestSchema = z.object({
  id: uuidSchema.optional(),
  key: nonEmptyStringSchema.optional(),
});
export type GetFileInfoRequest = z.infer<typeof getFileInfoRequestSchema>;

export const getSignedUrlRequestSchema = z.object({
  id: uuidSchema.optional(),
  key: nonEmptyStringSchema.optional(),
  expiresInSeconds: z.number().int().positive().optional(),
  /** Prefer named variants: `thumbnail` (~200) or `medium` (~800). Omit for original. */
  variant: z.enum(['thumbnail', 'medium']).optional(),
});
export type GetSignedUrlRequest = z.infer<typeof getSignedUrlRequestSchema>;

export const deleteFileRequestSchema = z.object({
  id: uuidSchema.optional(),
  key: nonEmptyStringSchema.optional(),
});
export type DeleteFileRequest = z.infer<typeof deleteFileRequestSchema>;

export const BATCH_OPERATION_TYPES = {
  GET: 'get',
  DELETE: 'delete',
} as const;

export const processorResultStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'partial',
  'skipped',
]);

export const processorResultSchema = z.object({
  id: z.string().uuid().optional(),
  fileId: z.string().uuid().optional(),
  processorKey: z.string(),
  status: processorResultStatusSchema.nullable().optional(),
  schemaVersion: z.number().int().optional(),
  backendId: z.string().uuid().nullable().optional(),
  backendKind: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  data: z.record(z.unknown()).nullable().optional(),
  error: z.string().nullable().optional(),
  processedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type ProcessorResult = z.infer<typeof processorResultSchema>;

export const processorResultsListSchema = z.object({
  items: z.array(processorResultSchema),
  total: z.number().int(),
});
export type ProcessorResultsList = z.infer<typeof processorResultsListSchema>;

export const fileMetadataSidecarSchema = z.object({
  fileId: z.string().uuid(),
  metadata: z.record(z.unknown()).nullable(),
  extractedAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  status: processorResultStatusSchema.nullable().optional(),
});
export type FileMetadataSidecar = z.infer<typeof fileMetadataSidecarSchema>;

export const fileVariantSchema = z.object({
  id: z.string().uuid().optional(),
  fileId: z.string().uuid().optional(),
  name: z.string().optional(),
  variantType: z.string().optional(),
  key: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.union([z.number(), z.string()]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type FileVariant = z.infer<typeof fileVariantSchema>;

export const fileVariantsListSchema = z.object({
  items: z.array(fileVariantSchema),
  total: z.number().int(),
});
export type FileVariantsList = z.infer<typeof fileVariantsListSchema>;

export const listProcessorResultsRequestSchema = z.object({
  id: uuidSchema,
  orgId: uuidSchema,
});
export type ListProcessorResultsRequest = z.infer<
  typeof listProcessorResultsRequestSchema
>;

export const getProcessorResultRequestSchema = z.object({
  id: uuidSchema,
  orgId: uuidSchema,
  processorKey: nonEmptyStringSchema,
});
export type GetProcessorResultRequest = z.infer<
  typeof getProcessorResultRequestSchema
>;
