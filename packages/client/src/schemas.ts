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
