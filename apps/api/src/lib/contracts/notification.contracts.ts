import { z } from 'zod';
import {
  uuidSchema,
  nonEmptyStringSchema,
  priorityEnum,
  prioritySchema,
  dateStringSchema,
  dataObjectSchema,
  paginationQuerySchema,
  paginationMetaSchema,
  booleanQuerySchema,
  urlSchema,
} from './common.schemas';

/**
 * Notification Service Contracts
 * These schemas define the API contracts for notification operations
 */

// ============================================================================
// Notification Types and Categories
// ============================================================================

export const notificationTypeSchema = z.enum([
  'info',
  'success',
  'warning',
  'error',
  'system',
]);

// Explicit union for stable typing across Zod v3/v4 skew (prevents `unknown`).
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'system';

export const notificationCategorySchema = z.enum([
  'account',
  'security',
  'billing',
  'feature',
  'update',
  'reminder',
  'social',
  'system',
]);

export type NotificationCategory =
  | 'account'
  | 'security'
  | 'billing'
  | 'feature'
  | 'update'
  | 'reminder'
  | 'social'
  | 'system';

// ============================================================================
// Notification Channels
// ============================================================================

export const notificationChannelSchema = z.enum([
  'in-app',
  'email',
  'sms',
  'push',
  'webhook',
]);

export type NotificationChannel = 'in-app' | 'email' | 'sms' | 'push' | 'webhook';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// ============================================================================
// Create Notification
// ============================================================================

export const createNotificationRequestSchema = z.object({
  userId: uuidSchema,
  title: nonEmptyStringSchema,
  message: nonEmptyStringSchema,
  type: notificationTypeSchema.default('info'),
  category: notificationCategorySchema.default('system'),
  priority: prioritySchema,
  actionUrl: urlSchema.optional(),
  actionText: z.string().optional(),
  icon: z.string().optional(),
  relatedEntityId: uuidSchema.optional(),
  relatedEntityType: z.string().optional(),
  data: dataObjectSchema.optional(),
  expiresAt: z.coerce.date().optional(),
  channels: z.array(notificationChannelSchema).default(['in-app']).optional(),
});

export type CreateNotificationRequest = {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  category?: NotificationCategory;
  priority: NotificationPriority;
  actionUrl?: string;
  actionText?: string;
  icon?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  data?: Record<string, unknown>;
  expiresAt?: Date;
  channels?: NotificationChannel[];
};

// ============================================================================
// Update Notification
// ============================================================================

export const updateNotificationRequestSchema = z.object({
  isRead: z.boolean().optional(),
  readAt: z.coerce.date().optional(),
  readByUserId: uuidSchema.optional(),
  isArchived: z.boolean().optional(),
  archivedAt: z.coerce.date().optional(),
});

export type UpdateNotificationRequest = z.infer<typeof updateNotificationRequestSchema>;

// ============================================================================
// Notification Response
// ============================================================================

export const notificationResponseSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  title: z.string(),
  message: z.string(),
  type: notificationTypeSchema,
  category: notificationCategorySchema,
  priority: prioritySchema,
  actionUrl: z.string().nullable(),
  actionText: z.string().nullable(),
  icon: z.string().nullable(),
  relatedEntityId: uuidSchema.nullable(),
  relatedEntityType: z.string().nullable(),
  data: dataObjectSchema.nullable(),
  isRead: z.boolean(),
  readAt: dateStringSchema.nullable(),
  readByUserId: uuidSchema.nullable(),
  isArchived: z.boolean(),
  archivedAt: dateStringSchema.nullable(),
  expiresAt: dateStringSchema.nullable(),
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
});

export type NotificationResponse = z.infer<typeof notificationResponseSchema>;

// ============================================================================
// Get Notifications (Query)
// ============================================================================

export const getNotificationsQuerySchema = paginationQuerySchema.extend({
  isRead: booleanQuerySchema.optional(),
  isArchived: booleanQuerySchema.optional(),
  type: notificationTypeSchema.optional(),
  category: notificationCategorySchema.optional(),
  priority: prioritySchema.optional(),
  sortBy: z.enum(['createdAt', 'priority', 'readAt']).default('createdAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

export const getNotificationsResponseSchema = z.object({
  data: z.array(notificationResponseSchema),
  meta: paginationMetaSchema,
});

export type GetNotificationsResponse = z.infer<typeof getNotificationsResponseSchema>;

// ============================================================================
// Bulk Operations
// ============================================================================

export const markAllAsReadRequestSchema = z.object({
  userId: uuidSchema,
  before: z.coerce.date().optional(),
});

export type MarkAllAsReadRequest = z.infer<typeof markAllAsReadRequestSchema>;

export const markAllAsReadResponseSchema = z.object({
  count: z.number().int().min(0),
  message: z.string().optional(),
});

export type MarkAllAsReadResponse = z.infer<typeof markAllAsReadResponseSchema>;

export const deleteAllNotificationsRequestSchema = z.object({
  userId: uuidSchema,
  before: z.coerce.date().optional(),
  isRead: z.boolean().optional(),
});

export type DeleteAllNotificationsRequest = z.infer<typeof deleteAllNotificationsRequestSchema>;

export const deleteAllNotificationsResponseSchema = z.object({
  count: z.number().int().min(0),
  message: z.string().optional(),
});

export type DeleteAllNotificationsResponse = z.infer<typeof deleteAllNotificationsResponseSchema>;

// ============================================================================
// Notification Preferences
// ============================================================================

export const channelPreferencesSchema = z.object({
  enabled: z.boolean().default(true),
  minPriority: prioritySchema.default('low').optional(),
  quietHoursStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:mm format
  quietHoursEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
});

export type ChannelPreferences = {
  enabled: boolean;
  minPriority?: NotificationPriority;
  quietHoursStart?: string;
  quietHoursEnd?: string;
};

export const notificationPreferencesSchema = z.object({
  userId: uuidSchema,
  channels: z.record(notificationChannelSchema, channelPreferencesSchema).optional(),
  categories: z.record(notificationCategorySchema, z.boolean()).optional(),
  doNotDisturb: z.boolean().default(false),
  doNotDisturbUntil: z.coerce.date().nullable().optional(),
});

export type NotificationPreferences = {
  userId: string;
  channels?: Partial<Record<NotificationChannel, ChannelPreferences>>;
  categories?: Partial<Record<NotificationCategory, boolean>>;
  doNotDisturb: boolean;
  doNotDisturbUntil?: Date | null;
};

export const updateNotificationPreferencesRequestSchema = z.object({
  channels: z.record(notificationChannelSchema, channelPreferencesSchema).optional(),
  categories: z.record(notificationCategorySchema, z.boolean()).optional(),
  doNotDisturb: z.boolean().optional(),
  doNotDisturbUntil: z.coerce.date().nullable().optional(),
});

export type UpdateNotificationPreferencesRequest = {
  channels?: Partial<Record<NotificationChannel, ChannelPreferences>>;
  categories?: Partial<Record<NotificationCategory, boolean>>;
  doNotDisturb?: boolean;
  doNotDisturbUntil?: Date | null;
};

export const notificationPreferencesResponseSchema = notificationPreferencesSchema.extend({
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
});

export type NotificationPreferencesResponse = NotificationPreferences & {
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// Notification Statistics
// ============================================================================

export const notificationStatsResponseSchema = z.object({
  total: z.number().int().min(0),
  unread: z.number().int().min(0),
  archived: z.number().int().min(0),
  byType: z.record(notificationTypeSchema, z.number().int()),
  byCategory: z.record(notificationCategorySchema, z.number().int()),
  byPriority: z.record(priorityEnum, z.number().int()),
});

export type NotificationStatsResponse = z.infer<typeof notificationStatsResponseSchema>;

// ============================================================================
// Individual Notification Operations
// ============================================================================

export const getNotificationByIdRequestSchema = z.object({
  id: uuidSchema,
});

export type GetNotificationByIdRequest = z.infer<typeof getNotificationByIdRequestSchema>;

export const markAsReadRequestSchema = z.object({
  id: uuidSchema,
  readByUserId: uuidSchema.optional(),
});

export type MarkAsReadRequest = z.infer<typeof markAsReadRequestSchema>;

export const archiveNotificationRequestSchema = z.object({
  id: uuidSchema,
});

export type ArchiveNotificationRequest = z.infer<typeof archiveNotificationRequestSchema>;

export const deleteNotificationRequestSchema = z.object({
  id: uuidSchema,
});

export type DeleteNotificationRequest = z.infer<typeof deleteNotificationRequestSchema>;

export const deleteNotificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type DeleteNotificationResponse = z.infer<typeof deleteNotificationResponseSchema>;

// ============================================================================
// Get Notifications Request (Microservice)
// ============================================================================

export const getNotificationsRequestSchema = z.object({
  userId: uuidSchema,
  limit: z.number().int().min(1).max(100).default(20).optional(),
  offset: z.number().int().min(0).default(0).optional(),
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  type: notificationTypeSchema.optional(),
  category: notificationCategorySchema.optional(),
  priority: prioritySchema.optional(),
});

export type GetNotificationsRequest = {
  userId: string;
  limit?: number;
  offset?: number;
  isRead?: boolean;
  isArchived?: boolean;
  type?: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
};
