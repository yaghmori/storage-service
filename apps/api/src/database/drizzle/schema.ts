import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Enum types
export const orgStatusEnum = pgEnum('org_status', ['active', 'suspended']);

export const storageProviderTypeEnum = pgEnum('storage_provider_type', [
  's3',
  'minio',
  'local',
]);
export const fileVisibilityEnum = pgEnum('file_visibility', [
  'public',
  'private',
  'unlisted',
]);
export const processingStatusEnum = pgEnum('processing_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);
export const variantTypeEnum = pgEnum('variant_type', [
  'thumbnail',
  'webp',
  'avif',
  'medium',
  'large',
  'xlarge',
  'preview-frame',
  'thumbnail-video',
  'preview-video',
]);
export const jobTypeEnum = pgEnum('job_type', [
  'image',
  'video',
  'metadata',
  'thumbnail',
  'transcode',
]);
export const downloadMethodEnum = pgEnum('download_method', [
  'direct',
  'signed_url',
  'cdn',
]);
export const detectionMethodEnum = pgEnum('detection_method', [
  'sha256',
  'content',
  'manual',
  'ai',
]);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    status: orgStatusEnum('status').default('active').notNull(),
    externalRef: varchar('external_ref', { length: 255 }),
    logoUrl: varchar('logo_url', { length: 500 }),
    frontendBaseUrl: varchar('frontend_base_url', { length: 500 }),
    customDomain: varchar('custom_domain', { length: 255 }),
    primaryColor: varchar('primary_color', { length: 50 }),
    secondaryColor: varchar('secondary_color', { length: 50 }),
    supportEmail: varchar('support_email', { length: 255 }),
    privacyUrl: varchar('privacy_url', { length: 500 }),
    termsUrl: varchar('terms_url', { length: 500 }),
    appBaseUrl: varchar('app_base_url', { length: 500 }),
    metadata: json('metadata'),
    /** Bytes occupied by files until hard purge (active + soft-deleted). */
    usedBytes: bigint('used_bytes', { mode: 'bigint' }).default(0n).notNull(),
    /** File count occupying storage until hard purge. */
    objectCount: integer('object_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index('organizations_slug_idx').on(table.slug),
    statusIdx: index('organizations_status_idx').on(table.status),
    externalRefIdx: index('organizations_external_ref_idx').on(table.externalRef),
  }),
);

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).default('admin').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (table) => ({
    emailIdx: index('admin_users_email_idx').on(table.email),
    emailActiveIdx: index('admin_users_email_active_idx').on(table.email, table.isActive),
  }),
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceName: varchar('service_name', { length: 255 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull(),
    permissions: json('permissions'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => ({
    serviceNameActiveIdx: index('api_keys_service_name_active_idx').on(
      table.serviceName,
      table.isActive,
    ),
    orgIdIdx: index('api_keys_org_id_idx').on(table.orgId),
    orgServiceUnique: uniqueIndex('api_keys_org_id_service_name_unique').on(
      table.orgId,
      table.serviceName,
    ),
  }),
);

export const storageProviders = pgTable(
  'storage_providers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: storageProviderTypeEnum('type').notNull(),
    config: jsonb('config').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    typeIdx: index('storage_providers_type_idx').on(table.type),
    activeIdx: index('storage_providers_active_idx').on(table.isActive),
    defaultIdx: index('storage_providers_default_idx').on(table.isDefault),
    orgIdIdx: index('storage_providers_org_id_idx').on(table.orgId),
    orgNameUnique: uniqueIndex('storage_providers_org_id_name_unique').on(
      table.orgId,
      table.name,
    ),
  }),
);

export const files = pgTable(
  'files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storageProviderId: uuid('storage_provider_id')
      .notNull()
      .references(() => storageProviders.id, {
        onDelete: 'restrict',
      }),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    storageBucket: varchar('storage_bucket', { length: 255 }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
    fileExtension: varchar('file_extension', { length: 50 }),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: bigint('size', { mode: 'bigint' }).notNull(),
    fileHash: varchar('file_hash', { length: 64 }).notNull(),
    checksum: varchar('checksum', { length: 64 }),
    width: integer('width'),
    height: integer('height'),
    aspectRatio: varchar('aspect_ratio', { length: 20 }),
    duration: integer('duration'),
    bitrate: integer('bitrate'),
    frameRate: integer('frame_rate'),
    hasTransparency: boolean('has_transparency').default(false),
    dominantColor: varchar('dominant_color', { length: 7 }),
    colorPalette: text('color_palette'),
    streamingUrl: text('streaming_url'),
    subtitleKeys: text('subtitle_keys'),
    alt: text('alt'),
    title: text('title'),
    caption: text('caption'),
    description: text('description'),
    transcript: text('transcript'),
    folder: varchar('folder', { length: 255 }),
    folderId: uuid('folder_id'),
    tags: text('tags'),
    referenceCount: integer('reference_count').notNull().default(1),
    isOrphaned: boolean('is_orphaned').default(false),
    orphanedAt: timestamp('orphaned_at', { withTimezone: false }),
    isProcessed: boolean('is_processed').default(false),
    processingStatus: processingStatusEnum('processing_status'),
    processingError: text('processing_error'),
    processingAttempts: integer('processing_attempts').default(0),
    aiGeneratedTags: text('ai_generated_tags'),
    aiDescription: text('ai_description'),
    objectDetection: text('object_detection'),
    faceDetection: text('face_detection'),
    nsfwScore: real('nsfw_score'),
    isNsfw: boolean('is_nsfw').default(false),
    visibility: fileVisibilityEnum('visibility').default('public'),
    downloadPassword: text('download_password'),
    uploadedBy: uuid('uploaded_by'),
    externalId: varchar('external_id', { length: 255 }),
    externalProvider: varchar('external_provider', { length: 100 }),
    cdnUrl: text('cdn_url'),
    deletedAt: timestamp('deleted_at', { withTimezone: false }),
    createdAt: timestamp('created_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    keyProviderUnique: unique('files_storage_key_provider_unique').on(
      table.storageKey,
      table.storageProviderId,
    ),
    orgHashUnique: unique('files_org_id_hash_unique').on(table.orgId, table.fileHash),
    hashIdx: index('files_file_hash_idx').on(table.fileHash),
    orgIdIdx: index('files_org_id_idx').on(table.orgId),
    providerIdx: index('files_storage_provider_idx').on(table.storageProviderId),
    mimeTypeIdx: index('files_mime_type_idx').on(table.mimeType),
    deletedAtIdx: index('files_deleted_at_idx').on(table.deletedAt),
    createdAtIdx: index('files_created_at_idx').on(table.createdAt),
    folderIdIdx: index('files_folder_id_idx').on(table.folderId),
    uploadedByIdx: index('files_uploaded_by_idx').on(table.uploadedBy),
    processingStatusIdx: index('files_processing_status_idx').on(table.processingStatus),
    visibilityIdx: index('files_visibility_idx').on(table.visibility),
    isOrphanedIdx: index('files_is_orphaned_idx').on(table.isOrphaned),
    referenceCountCheck: check(
      'files_reference_count_check',
      sql`${table.referenceCount} >= 0`,
    ),
    sizeCheck: check('files_size_check', sql`${table.size} >= 0`),
    processingAttemptsCheck: check(
      'files_processing_attempts_check',
      sql`${table.processingAttempts} >= 0`,
    ),
    nsfwScoreCheck: check(
      'files_nsfw_score_check',
      sql`${table.nsfwScore} IS NULL OR (${table.nsfwScore} >= 0 AND ${table.nsfwScore} <= 1)`,
    ),
  }),
);

export const fileMetadata = pgTable(
  'file_metadata',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').notNull(),
    extractedAt: timestamp('extracted_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    fileIdIdx: index('file_metadata_file_id_idx').on(table.fileId),
    fileIdUnique: unique('file_metadata_file_id_unique').on(table.fileId),
  }),
);

export const fileVariants = pgTable(
  'file_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    variantType: variantTypeEnum('variant_type').notNull(),
    variantKey: varchar('variant_key', { length: 500 }).notNull(),
    storageProviderId: uuid('storage_provider_id')
      .notNull()
      .references(() => storageProviders.id, {
        onDelete: 'restrict',
      }),
    size: bigint('size', { mode: 'bigint' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    quality: integer('quality'),
    format: varchar('format', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    variantKeyProviderUnique: unique('file_variants_key_provider_unique').on(
      table.variantKey,
      table.storageProviderId,
    ),
    fileIdIdx: index('file_variants_file_id_idx').on(table.fileId),
    variantTypeIdx: index('file_variants_type_idx').on(table.variantType),
    providerIdx: index('file_variants_storage_provider_idx').on(table.storageProviderId),
    fileVariantIdx: index('file_variants_file_type_idx').on(table.fileId, table.variantType),
    sizeCheck: check('file_variants_size_check', sql`${table.size} >= 0`),
    qualityCheck: check(
      'file_variants_quality_check',
      sql`${table.quality} IS NULL OR (${table.quality} >= 1 AND ${table.quality} <= 100)`,
    ),
  }),
);

export const processingJobs = pgTable(
  'processing_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    jobType: jobTypeEnum('job_type').notNull(),
    status: processingStatusEnum('status').notNull().default('pending'),
    bullmqJobId: varchar('bullmq_job_id', { length: 255 }),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),
    progress: integer('progress'),
    priority: integer('priority').default(0),
    createdAt: timestamp('created_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: false }),
    completedAt: timestamp('completed_at', { withTimezone: false }),
  },
  (table) => ({
    orgIdIdx: index('processing_jobs_org_id_idx').on(table.orgId),
    fileIdIdx: index('processing_jobs_file_id_idx').on(table.fileId),
    statusIdx: index('processing_jobs_status_idx').on(table.status),
    jobTypeIdx: index('processing_jobs_job_type_idx').on(table.jobType),
    bullmqJobIdIdx: index('processing_jobs_bullmq_job_id_idx').on(table.bullmqJobId),
    bullmqJobIdUnique: unique('processing_jobs_bullmq_job_id_unique').on(
      table.bullmqJobId,
    ),
    fileStatusIdx: index('processing_jobs_file_status_idx').on(table.fileId, table.status),
    retryCountCheck: check(
      'processing_jobs_retry_count_check',
      sql`${table.retryCount} >= 0`,
    ),
    progressCheck: check(
      'processing_jobs_progress_check',
      sql`${table.progress} IS NULL OR (${table.progress} >= 0 AND ${table.progress} <= 100)`,
    ),
  }),
);

export const downloadLogs = pgTable(
  'download_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => fileVariants.id, {
      onDelete: 'set null',
    }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    userId: uuid('user_id'),
    bytesDownloaded: bigint('bytes_downloaded', { mode: 'bigint' }),
    downloadMethod: downloadMethodEnum('download_method'),
    referer: text('referer'),
    downloadedAt: timestamp('downloaded_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdIdx: index('download_logs_org_id_idx').on(table.orgId),
    fileIdIdx: index('download_logs_file_id_idx').on(table.fileId),
    variantIdIdx: index('download_logs_variant_id_idx').on(table.variantId),
    downloadedAtIdx: index('download_logs_downloaded_at_idx').on(table.downloadedAt),
    ipAddressIdx: index('download_logs_ip_address_idx').on(table.ipAddress),
    userIdIdx: index('download_logs_user_id_idx').on(table.userId),
    fileDateIdx: index('download_logs_file_date_idx').on(table.fileId, table.downloadedAt),
  }),
);

export const fileDuplicates = pgTable(
  'file_duplicates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    originalFileId: uuid('original_file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    detectedAt: timestamp('detected_at', { withTimezone: false })
      .notNull()
      .defaultNow(),
    detectionMethod: detectionMethodEnum('detection_method')
      .notNull()
      .default('sha256'),
    similarityScore: real('similarity_score'),
    uploadedBy: uuid('uploaded_by'),
    isConfirmed: boolean('is_confirmed').default(false),
    confirmedBy: uuid('confirmed_by'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: false }),
  },
  (table) => ({
    orgIdIdx: index('file_duplicates_org_id_idx').on(table.orgId),
    originalFileIdx: index('file_duplicates_original_idx').on(table.originalFileId),
    detectedAtIdx: index('file_duplicates_detected_at_idx').on(table.detectedAt),
    uploadedByIdx: index('file_duplicates_uploaded_by_idx').on(table.uploadedBy),
    similarityScoreCheck: check(
      'file_duplicates_similarity_check',
      sql`${table.similarityScore} IS NULL OR (${table.similarityScore} >= 0 AND ${table.similarityScore} <= 1)`,
    ),
  }),
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  apiKeys: many(apiKeys),
  providers: many(storageProviders),
  files: many(files),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.orgId],
    references: [organizations.id],
  }),
}));

export const storageProvidersRelations = relations(storageProviders, ({ one }) => ({
  organization: one(organizations, {
    fields: [storageProviders.orgId],
    references: [organizations.id],
  }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  organization: one(organizations, {
    fields: [files.orgId],
    references: [organizations.id],
  }),
  provider: one(storageProviders, {
    fields: [files.storageProviderId],
    references: [storageProviders.id],
  }),
}));

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
