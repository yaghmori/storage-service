import { z } from 'zod';
import {
  emailSchema,
  nonEmptyStringSchema,
  localeSchema,
  tenantIdSchema,
  dataObjectSchema,
  uuidSchema,
  dateStringSchema,
} from './common.schemas';

/**
 * Email Service Contracts
 * These schemas define the API contracts for email operations
 */

// ============================================================================
// Template Types
// ============================================================================

export const templateTypeSchema = z.enum([
  'transactional',
  'marketing',
  'notification',
  'system',
]);

// Explicit union for stable typing across Zod v3/v4 skew (prevents `unknown`).
export type TemplateType =
  | 'transactional'
  | 'marketing'
  | 'notification'
  | 'system';

// ============================================================================
// Provider Types
// ============================================================================

export const providerTypeSchema = z.enum([
  'postal',
  'ses',
  'mailgun',
  'smtp',
  'gmail',
  'sendgrid',
  'postmark',
]);

export type ProviderType =
  | 'postal'
  | 'ses'
  | 'mailgun'
  | 'smtp'
  | 'gmail'
  | 'sendgrid'
  | 'postmark';

// ============================================================================
// Send Email
// ============================================================================

export const sendEmailRequestSchema = z.object({
  to: emailSchema,
  template: nonEmptyStringSchema.optional(),
  locale: localeSchema.optional(),
  tenantId: tenantIdSchema.optional(),
  data: dataObjectSchema.optional(),
  from: emailSchema.optional(),
  fromName: z.string().optional(),
  subject: nonEmptyStringSchema.optional(),
  provider: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
});

export type SendEmailRequest = z.infer<typeof sendEmailRequestSchema>;

export const sendEmailResponseSchema = z.object({
  id: uuidSchema,
  messageId: z.string(),
  status: z.enum(['queued', 'sent', 'failed']),
  message: z.string().optional(),
});

export type SendEmailResponse = z.infer<typeof sendEmailResponseSchema>;

// ============================================================================
// Templates
// ============================================================================

export const createTemplateRequestSchema = z.object({
  key: nonEmptyStringSchema,
  description: z.string().optional(),
  type: templateTypeSchema,
  schema: dataObjectSchema.optional(),
});

export type CreateTemplateRequest = {
  key: string;
  description?: string;
  type: TemplateType;
  schema?: Record<string, unknown>;
};

export const updateTemplateRequestSchema = z.object({
  key: nonEmptyStringSchema.optional(),
  description: z.string().optional(),
  type: templateTypeSchema.optional(),
  schema: dataObjectSchema.optional(),
});

export type UpdateTemplateRequest = {
  key?: string;
  description?: string;
  type?: TemplateType;
  schema?: Record<string, unknown>;
};

export const templateResponseSchema = z.object({
  id: uuidSchema,
  key: z.string(),
  description: z.string().nullable(),
  type: templateTypeSchema,
  schema: dataObjectSchema.nullable(),
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
  isActive: z.boolean(),
});

export type TemplateResponse = z.infer<typeof templateResponseSchema>;

// ============================================================================
// Template Versions
// ============================================================================

export const createTemplateVersionRequestSchema = z.object({
  locale: localeSchema,
  subject: nonEmptyStringSchema,
  html: nonEmptyStringSchema,
  text: z.string().optional(),
  version: z.number().int().min(1).optional(),
});

export type CreateTemplateVersionRequest = z.infer<typeof createTemplateVersionRequestSchema>;

export const updateTemplateVersionRequestSchema = z.object({
  locale: localeSchema.optional(),
  subject: nonEmptyStringSchema.optional(),
  html: nonEmptyStringSchema.optional(),
  text: z.string().optional(),
  version: z.number().int().min(1).optional(),
});

export type UpdateTemplateVersionRequest = z.infer<typeof updateTemplateVersionRequestSchema>;

export const templateVersionResponseSchema = z.object({
  id: uuidSchema,
  templateId: uuidSchema,
  locale: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string().nullable(),
  version: z.number().int(),
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
  isActive: z.boolean(),
});

export type TemplateVersionResponse = z.infer<typeof templateVersionResponseSchema>;

// ============================================================================
// Email Providers
// ============================================================================

export const providerConfigSchema = z.record(z.string(), z.unknown());

export const createProviderRequestSchema = z.object({
  name: nonEmptyStringSchema,
  type: providerTypeSchema,
  config: providerConfigSchema,
  isActive: z.boolean().default(true).optional(),
  isDefault: z.boolean().default(false).optional(),
  priority: z.number().int().min(0).default(0).optional(),
});

export type CreateProviderRequest = {
  name: string;
  type: ProviderType;
  config: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  priority?: number;
};

export const updateProviderRequestSchema = z.object({
  name: nonEmptyStringSchema.optional(),
  config: providerConfigSchema.optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

export type UpdateProviderRequest = {
  name?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  priority?: number;
};

export const providerResponseSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  type: providerTypeSchema,
  config: providerConfigSchema,
  isActive: z.boolean(),
  isDefault: z.boolean(),
  priority: z.number().int(),
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
});

// Explicit shape so `type` never becomes `unknown` in consumers.
export type ProviderResponse = {
  id: string;
  name: string;
  type: ProviderType;
  config: Record<string, unknown>;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// Email History/Logs
// ============================================================================

export const emailStatusSchema = z.enum([
  'queued',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'rejected',
  'opened',
  'clicked',
]);

export type EmailStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'rejected'
  | 'opened'
  | 'clicked';

export const emailLogResponseSchema = z.object({
  id: uuidSchema,
  to: emailSchema,
  from: emailSchema.optional(),
  subject: z.string(),
  templateKey: z.string().nullable(),
  status: emailStatusSchema,
  provider: z.string(),
  messageId: z.string().nullable(),
  error: z.string().nullable(),
  sentAt: dateStringSchema.nullable(),
  deliveredAt: dateStringSchema.nullable(),
  openedAt: dateStringSchema.nullable(),
  clickedAt: dateStringSchema.nullable(),
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
});

export type EmailLogResponse = z.infer<typeof emailLogResponseSchema>;

// ============================================================================
// Email Message Operations
// ============================================================================

export const getEmailMessageRequestSchema = z.object({
  id: uuidSchema,
});

export type GetEmailMessageRequest = z.infer<typeof getEmailMessageRequestSchema>;

export const listEmailMessagesRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20).optional(),
  offset: z.number().int().min(0).default(0).optional(),
  status: emailStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListEmailMessagesRequest = {
  limit?: number;
  offset?: number;
  status?: EmailStatus;
  from?: Date;
  to?: Date;
};

export const listEmailMessagesResponseSchema = z.object({
  messages: z.array(emailLogResponseSchema),
  total: z.number().int().min(0),
});

export type ListEmailMessagesResponse = z.infer<typeof listEmailMessagesResponseSchema>;

export const retryEmailMessageRequestSchema = z.object({
  id: uuidSchema,
});

export type RetryEmailMessageRequest = z.infer<typeof retryEmailMessageRequestSchema>;

export const retryEmailMessageResponseSchema = z.object({
  success: z.boolean(),
  messageId: uuidSchema,
  message: z.string().optional(),
});

export type RetryEmailMessageResponse = z.infer<typeof retryEmailMessageResponseSchema>;
