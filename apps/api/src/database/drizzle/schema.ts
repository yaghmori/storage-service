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
export type JobLogEntry = {
  ts: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
};

/** Job execution status (+ file rollup `partial`). */
export const processingStatusEnum = pgEnum('processing_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'partial',
  'skipped',
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

export const users = pgTable(
  'users',
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
    emailIdx: index('users_email_idx').on(table.email),
    emailActiveIdx: index('users_email_active_idx').on(table.email, table.isActive),
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

/** External processor endpoints (Ollama, OpenAI-compatible, ClamAV, webhooks, …). */
export const processorBackends = pgTable(
  'processor_backends',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    /** e.g. openai_compatible | clamav | http_webhook | internal */
    kind: varchar('kind', { length: 64 }).notNull(),
    config: jsonb('config').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdIdx: index('processor_backends_org_id_idx').on(table.orgId),
    kindIdx: index('processor_backends_kind_idx').on(table.kind),
    activeIdx: index('processor_backends_active_idx').on(table.isActive),
    orgNameUnique: uniqueIndex('processor_backends_org_id_name_unique').on(
      table.orgId,
      table.name,
    ),
    orgKindDefaultUnique: uniqueIndex('processor_backends_org_kind_default_unique')
      .on(table.orgId, table.kind)
      .where(sql`${table.isDefault} = true`),
  }),
);

/** Per-org pipeline bindings: which registered processors run and with what settings. */
export const orgProcessors = pgTable(
  'org_processors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    processorKey: varchar('processor_key', { length: 128 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    mimeInclude: text('mime_include').array(),
    settings: jsonb('settings').notNull().default({}),
    backendId: uuid('backend_id').references(() => processorBackends.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdIdx: index('org_processors_org_id_idx').on(table.orgId),
    processorKeyIdx: index('org_processors_processor_key_idx').on(table.processorKey),
    orgProcessorUnique: uniqueIndex('org_processors_org_id_processor_key_unique').on(
      table.orgId,
      table.processorKey,
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
    perceptualHash: varchar('perceptual_hash', { length: 64 }),
    width: integer('width'),
    height: integer('height'),
    duration: integer('duration'),
    alt: text('alt'),
    title: text('title'),
    caption: text('caption'),
    description: text('description'),
    folder: varchar('folder', { length: 255 }),
    folderId: uuid('folder_id'),
    tags: text('tags'),
    referenceCount: integer('reference_count').notNull().default(1),
    isOrphaned: boolean('is_orphaned').default(false),
    orphanedAt: timestamp('orphaned_at', { withTimezone: false }),
    processingStatus: processingStatusEnum('processing_status'),
    processingError: text('processing_error'),
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
    orgPerceptualHashIdx: index('files_org_perceptual_hash_idx').on(
      table.orgId,
      table.perceptualHash,
    ),
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
  }),
);

export const fileVariants = pgTable(
  'file_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    /** Open string so processors can add artifact kinds without migrations. */
    variantType: varchar('variant_type', { length: 64 }).notNull(),
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
    processorKey: varchar('processor_key', { length: 128 }).notNull(),
    status: processingStatusEnum('status').notNull().default('pending'),
    backendId: uuid('backend_id').references(() => processorBackends.id, {
      onDelete: 'set null',
    }),
    parameters: jsonb('parameters').default({}),
    bullmqJobId: varchar('bullmq_job_id', { length: 255 }),
    errorMessage: text('error_message'),
    /** Append-only job log lines for live / post-mortem debugging. */
    logs: jsonb('logs')
      .$type<JobLogEntry[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Final structured output when the processor produces JSON (e.g. ai.vision). */
    output: jsonb('output').$type<Record<string, unknown> | null>(),
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
    processorKeyIdx: index('processing_jobs_processor_key_idx').on(table.processorKey),
    bullmqJobIdIdx: index('processing_jobs_bullmq_job_id_idx').on(table.bullmqJobId),
    bullmqJobIdUnique: unique('processing_jobs_bullmq_job_id_unique').on(
      table.bullmqJobId,
    ),
    fileStatusIdx: index('processing_jobs_file_status_idx').on(table.fileId, table.status),
    inFlightUnique: uniqueIndex('processing_jobs_file_processor_inflight_unique')
      .on(table.fileId, table.processorKey)
      .where(sql`${table.status} IN ('pending', 'processing')`),
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

/** Current JSON/analysis output per (file, processor). Binary artifacts use file_variants. */
export const fileProcessorResults = pgTable(
  'file_processor_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    processorKey: varchar('processor_key', { length: 128 }).notNull(),
    status: processingStatusEnum('status').notNull().default('pending'),
    schemaVersion: integer('schema_version').notNull().default(1),
    backendId: uuid('backend_id').references(() => processorBackends.id, {
      onDelete: 'set null',
    }),
    backendKind: varchar('backend_kind', { length: 64 }),
    model: varchar('model', { length: 255 }),
    data: jsonb('data').notNull().default({}),
    error: text('error'),
    jobId: uuid('job_id').references(() => processingJobs.id, {
      onDelete: 'set null',
    }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdIdx: index('file_processor_results_org_id_idx').on(table.orgId),
    fileIdIdx: index('file_processor_results_file_id_idx').on(table.fileId),
    processorKeyIdx: index('file_processor_results_processor_key_idx').on(
      table.processorKey,
    ),
    orgProcessorIdx: index('file_processor_results_org_processor_idx').on(
      table.orgId,
      table.processorKey,
    ),
    fileProcessorUnique: uniqueIndex('file_processor_results_file_processor_unique').on(
      table.fileId,
      table.processorKey,
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
    /** Near-dupe / related file (content matches). Null for SHA upload-only flags. */
    duplicateFileId: uuid('duplicate_file_id').references(() => files.id, {
      onDelete: 'cascade',
    }),
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
    duplicateFileIdx: index('file_duplicates_duplicate_file_idx').on(
      table.duplicateFileId,
    ),
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
  processorBackends: many(processorBackends),
  orgProcessors: many(orgProcessors),
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

export const processorBackendsRelations = relations(processorBackends, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [processorBackends.orgId],
    references: [organizations.id],
  }),
  orgProcessors: many(orgProcessors),
}));

export const orgProcessorsRelations = relations(orgProcessors, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgProcessors.orgId],
    references: [organizations.id],
  }),
  backend: one(processorBackends, {
    fields: [orgProcessors.backendId],
    references: [processorBackends.id],
  }),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [files.orgId],
    references: [organizations.id],
  }),
  provider: one(storageProviders, {
    fields: [files.storageProviderId],
    references: [storageProviders.id],
  }),
  processorResults: many(fileProcessorResults),
  variants: many(fileVariants),
  jobs: many(processingJobs),
}));

export const fileProcessorResultsRelations = relations(fileProcessorResults, ({ one }) => ({
  file: one(files, {
    fields: [fileProcessorResults.fileId],
    references: [files.id],
  }),
  organization: one(organizations, {
    fields: [fileProcessorResults.orgId],
    references: [organizations.id],
  }),
  backend: one(processorBackends, {
    fields: [fileProcessorResults.backendId],
    references: [processorBackends.id],
  }),
  job: one(processingJobs, {
    fields: [fileProcessorResults.jobId],
    references: [processingJobs.id],
  }),
}));

/** Pending direct-to-object-store uploads (presigned PUT / multipart). */
export const uploadSessions = pgTable(
  'upload_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storageProviderId: uuid('storage_provider_id')
      .notNull()
      .references(() => storageProviders.id, { onDelete: 'restrict' }),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    storageBucket: varchar('storage_bucket', { length: 255 }),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    declaredSize: bigint('declared_size', { mode: 'bigint' }).notNull(),
    multipartUploadId: varchar('multipart_upload_id', { length: 255 }),
    partSize: integer('part_size'),
    skipProcessing: boolean('skip_processing').notNull().default(false),
    uploadedBy: uuid('uploaded_by'),
    /** pending | completed | aborted | expired */
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    orgIdIdx: index('upload_sessions_org_id_idx').on(table.orgId),
    statusIdx: index('upload_sessions_status_idx').on(table.status),
    expiresAtIdx: index('upload_sessions_expires_at_idx').on(table.expiresAt),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type AdminUser = typeof users.$inferSelect;
export type NewAdminUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ProcessorBackend = typeof processorBackends.$inferSelect;
export type NewProcessorBackend = typeof processorBackends.$inferInsert;
export type OrgProcessor = typeof orgProcessors.$inferSelect;
export type NewOrgProcessor = typeof orgProcessors.$inferInsert;
export type FileProcessorResult = typeof fileProcessorResults.$inferSelect;
export type NewFileProcessorResult = typeof fileProcessorResults.$inferInsert;
export type UploadSession = typeof uploadSessions.$inferSelect;
export type NewUploadSession = typeof uploadSessions.$inferInsert;
