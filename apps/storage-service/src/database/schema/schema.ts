import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

// Enum types
export const storageProviderTypeEnum = pgEnum('storage_provider_type', ['s3', 'minio', 'local']);
export const fileVisibilityEnum = pgEnum('file_visibility', ['public', 'private', 'unlisted']);
export const processingStatusEnum = pgEnum('processing_status', ['pending', 'processing', 'completed', 'failed', 'cancelled']);
export const variantTypeEnum = pgEnum('variant_type', ['thumbnail', 'webp', 'avif', 'medium', 'large', 'xlarge', 'preview-frame', 'thumbnail-video', 'preview-video']);
export const jobTypeEnum = pgEnum('job_type', ['image', 'video', 'metadata', 'thumbnail', 'transcode']);
export const downloadMethodEnum = pgEnum('download_method', ['direct', 'signed_url', 'cdn']);
export const detectionMethodEnum = pgEnum('detection_method', ['sha256', 'content', 'manual', 'ai']);

export const storageProviders = pgTable('storage_providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  type: storageProviderTypeEnum('type').notNull(),
  config: jsonb('config').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  typeIdx: index('storage_providers_type_idx').on(table.type),
  activeIdx: index('storage_providers_active_idx').on(table.isActive),
  defaultIdx: index('storage_providers_default_idx').on(table.isDefault),
}));

export const files = pgTable('files', {
  // Primary key - using UUID for better distributed system support
  id: uuid('id').defaultRandom().primaryKey(),

  // Storage information
  storageProviderId: uuid('storage_provider_id').notNull().references(() => storageProviders.id, {
    onDelete: 'restrict' // Prevent deletion of provider if files exist
  }),
  storageKey: varchar('storage_key', { length: 500 }).notNull(), // The actual key in storage
  storageBucket: varchar('storage_bucket', { length: 255 }), // Bucket name if applicable

  // File identification
  fileName: varchar('file_name', { length: 255 }).notNull(), // Generated unique filename
  originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
  fileExtension: varchar('file_extension', { length: 50 }), // Extracted extension
  mimeType: varchar('mime_type', { length: 100 }).notNull(),

  // File properties
  size: bigint('size', { mode: 'bigint' }).notNull(),
  fileHash: varchar('file_hash', { length: 64 }).notNull(), // SHA-256 hash
  checksum: varchar('checksum', { length: 64 }), // Additional checksum if needed

  // Media properties (images/videos)
  width: integer('width'),
  height: integer('height'),
  aspectRatio: varchar('aspect_ratio', { length: 20 }), // e.g., "16:9", "4:3"
  duration: integer('duration'), // Duration in seconds (for video/audio)
  bitrate: integer('bitrate'), // Bitrate in bps
  frameRate: integer('frame_rate'), // Frames per second
  hasTransparency: boolean('has_transparency').default(false),
  dominantColor: varchar('dominant_color', { length: 7 }), // Hex color
  colorPalette: text('color_palette'), // JSON array of colors

  // Note: All variants are stored in file_variants table
  // Use variants service to query variants - no duplication here
  streamingUrl: text('streaming_url'), // For video streaming (external URL)
  subtitleKeys: text('subtitle_keys'), // JSON array of subtitle file keys

  // Metadata and descriptions
  alt: text('alt'), // Alt text for accessibility
  title: text('title'),
  caption: text('caption'),
  description: text('description'),
  transcript: text('transcript'), // For audio/video

  // Organization
  folder: varchar('folder', { length: 255 }),
  folderId: uuid('folder_id'), // Reference to folder structure if needed
  tags: text('tags'), // Comma-separated or JSON array

  // Reference counting (for deletion strategy - not usage tracking)
  // Usage/download tracking is in downloadLogs table
  referenceCount: integer('reference_count').notNull().default(1),

  // Note: Duplicate relationships are tracked in fileDuplicates table
  // Note: Usage/download tracking is in downloadLogs table
  // Note: Metadata is stored in fileMetadata table

  // Orphaned file management
  isOrphaned: boolean('is_orphaned').default(false),
  orphanedAt: timestamp('orphaned_at', { withTimezone: false }),

  // Processing status
  isProcessed: boolean('is_processed').default(false),
  processingStatus: processingStatusEnum('processing_status'),
  processingError: text('processing_error'),
  processingAttempts: integer('processing_attempts').default(0),

  // Note: All metadata (EXIF, IPTC, XMP) is stored in fileMetadata table

  // AI/ML fields (for future enhancements)
  aiGeneratedTags: text('ai_generated_tags'), // JSON array
  aiDescription: text('ai_description'),
  objectDetection: text('object_detection'), // JSON array of detected objects
  faceDetection: text('face_detection'), // JSON array of detected faces
  nsfwScore: real('nsfw_score'), // 0.0 to 1.0
  isNsfw: boolean('is_nsfw').default(false),

  // Access control
  visibility: fileVisibilityEnum('visibility').default('public'),
  downloadPassword: text('download_password'), // Hashed password if protected
  uploadedBy: uuid('uploaded_by'), // User ID (UUID) if available

  // External integrations
  externalId: varchar('external_id', { length: 255 }),
  externalProvider: varchar('external_provider', { length: 100 }),
  cdnUrl: text('cdn_url'), // CDN URL if using CDN

  // Soft delete support
  deletedAt: timestamp('deleted_at', { withTimezone: false }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: storage key must be unique per provider
  keyProviderUnique: unique('files_storage_key_provider_unique').on(table.storageKey, table.storageProviderId),
  // Unique constraint: file hash for duplicate detection
  hashUnique: unique('files_hash_unique').on(table.fileHash),
  // Indexes for performance
  hashIdx: index('files_file_hash_idx').on(table.fileHash), // Critical for duplicate detection
  providerIdx: index('files_storage_provider_idx').on(table.storageProviderId),
  mimeTypeIdx: index('files_mime_type_idx').on(table.mimeType),
  deletedAtIdx: index('files_deleted_at_idx').on(table.deletedAt),
  createdAtIdx: index('files_created_at_idx').on(table.createdAt),
  folderIdIdx: index('files_folder_id_idx').on(table.folderId),
  uploadedByIdx: index('files_uploaded_by_idx').on(table.uploadedBy),
  processingStatusIdx: index('files_processing_status_idx').on(table.processingStatus),
  visibilityIdx: index('files_visibility_idx').on(table.visibility),
  isOrphanedIdx: index('files_is_orphaned_idx').on(table.isOrphaned),
  // Check constraints
  referenceCountCheck: check('files_reference_count_check', sql`${table.referenceCount} >= 0`),
  sizeCheck: check('files_size_check', sql`${table.size} >= 0`),
  processingAttemptsCheck: check('files_processing_attempts_check', sql`${table.processingAttempts} >= 0`),
  nsfwScoreCheck: check('files_nsfw_score_check', sql`${table.nsfwScore} IS NULL OR (${table.nsfwScore} >= 0 AND ${table.nsfwScore} <= 1)`),
}));

export const fileMetadata = pgTable('file_metadata', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  metadata: jsonb('metadata').notNull(), // Full metadata object
  extractedAt: timestamp('extracted_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  // Index for file lookup
  fileIdIdx: index('file_metadata_file_id_idx').on(table.fileId),
}));

export const fileVariants = pgTable('file_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  variantType: variantTypeEnum('variant_type').notNull(),
  variantKey: varchar('variant_key', { length: 500 }).notNull(),
  storageProviderId: uuid('storage_provider_id').notNull().references(() => storageProviders.id, {
    onDelete: 'restrict'
  }),
  size: bigint('size', { mode: 'bigint' }).notNull(),
  width: integer('width'), // Image/video width
  height: integer('height'), // Image/video height
  quality: integer('quality'), // Quality setting (1-100)
  format: varchar('format', { length: 20 }), // 'jpeg', 'png', 'webp', 'avif', 'mp4', etc.
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: variant key must be unique per provider
  variantKeyProviderUnique: unique('file_variants_key_provider_unique').on(table.variantKey, table.storageProviderId),
  // Indexes for performance
  fileIdIdx: index('file_variants_file_id_idx').on(table.fileId),
  variantTypeIdx: index('file_variants_type_idx').on(table.variantType),
  providerIdx: index('file_variants_storage_provider_idx').on(table.storageProviderId),
  // Composite index for common queries
  fileVariantIdx: index('file_variants_file_type_idx').on(table.fileId, table.variantType),
  // Check constraints
  sizeCheck: check('file_variants_size_check', sql`${table.size} >= 0`),
  qualityCheck: check('file_variants_quality_check', sql`${table.quality} IS NULL OR (${table.quality} >= 1 AND ${table.quality} <= 100)`),
}));

export const processingJobs = pgTable('processing_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  jobType: jobTypeEnum('job_type').notNull(),
  status: processingStatusEnum('status').notNull().default('pending'),
  bullmqJobId: varchar('bullmq_job_id', { length: 255 }),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  progress: integer('progress'), // 0-100
  priority: integer('priority').default(0), // Higher priority jobs processed first
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: false }),
  completedAt: timestamp('completed_at', { withTimezone: false }),
}, (table) => ({
  // Indexes for performance
  fileIdIdx: index('processing_jobs_file_id_idx').on(table.fileId),
  statusIdx: index('processing_jobs_status_idx').on(table.status),
  jobTypeIdx: index('processing_jobs_job_type_idx').on(table.jobType),
  bullmqJobIdIdx: index('processing_jobs_bullmq_job_id_idx').on(table.bullmqJobId),
  // Composite index for common queries
  fileStatusIdx: index('processing_jobs_file_status_idx').on(table.fileId, table.status),
  // Check constraints
  retryCountCheck: check('processing_jobs_retry_count_check', sql`${table.retryCount} >= 0`),
  progressCheck: check('processing_jobs_progress_check', sql`${table.progress} IS NULL OR (${table.progress} >= 0 AND ${table.progress} <= 100)`),
}));

export const downloadLogs = pgTable('download_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => fileVariants.id, { onDelete: 'set null' }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  userId: uuid('user_id'), // User ID (UUID) if available
  bytesDownloaded: bigint('bytes_downloaded', { mode: 'bigint' }), // Actual bytes downloaded
  downloadMethod: downloadMethodEnum('download_method'),
  referer: text('referer'), // HTTP referer
  downloadedAt: timestamp('downloaded_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance and analytics
  // Single source of truth for all download/usage tracking
  fileIdIdx: index('download_logs_file_id_idx').on(table.fileId),
  variantIdIdx: index('download_logs_variant_id_idx').on(table.variantId),
  downloadedAtIdx: index('download_logs_downloaded_at_idx').on(table.downloadedAt),
  ipAddressIdx: index('download_logs_ip_address_idx').on(table.ipAddress),
  userIdIdx: index('download_logs_user_id_idx').on(table.userId),
  // Composite index for time-based analytics
  fileDateIdx: index('download_logs_file_date_idx').on(table.fileId, table.downloadedAt),
}));

// File Duplicates - tracks duplicate upload attempts
// Since we have a unique constraint on fileHash, we can't create multiple file records with the same hash.
// This table tracks when users attempt to upload files that already exist.
// All file metadata (mimeType, size, originalFileName) can be retrieved from the files table via originalFileId.
export const fileDuplicates = pgTable('file_duplicates', {
  id: uuid('id').defaultRandom().primaryKey(),
  originalFileId: uuid('original_file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  detectedAt: timestamp('detected_at', { withTimezone: false }).notNull().defaultNow(),
  detectionMethod: detectionMethodEnum('detection_method').notNull().default('sha256'),
  similarityScore: real('similarity_score'), // 0.0 to 1.0 for content-based detection (future use)
  uploadedBy: uuid('uploaded_by'), // User ID (UUID) who uploaded (if available) - useful for tracking who uploaded duplicates
  isConfirmed: boolean('is_confirmed').default(false), // Manually confirmed duplicate (future use)
  confirmedBy: uuid('confirmed_by'), // User ID (UUID) who confirmed (future use)
  confirmedAt: timestamp('confirmed_at', { withTimezone: false }), // When confirmed (future use)
}, (table) => ({
  // Indexes for performance
  originalFileIdx: index('file_duplicates_original_idx').on(table.originalFileId),
  detectedAtIdx: index('file_duplicates_detected_at_idx').on(table.detectedAt),
  uploadedByIdx: index('file_duplicates_uploaded_by_idx').on(table.uploadedBy),
  // Check constraint: similarity score must be between 0 and 1
  similarityScoreCheck: check('file_duplicates_similarity_check', sql`${table.similarityScore} IS NULL OR (${table.similarityScore} >= 0 AND ${table.similarityScore} <= 1)`),
}));


