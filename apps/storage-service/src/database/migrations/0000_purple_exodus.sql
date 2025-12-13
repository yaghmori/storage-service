CREATE TYPE "public"."detection_method" AS ENUM('sha256', 'content', 'manual', 'ai');--> statement-breakpoint
CREATE TYPE "public"."download_method" AS ENUM('direct', 'signed_url', 'cdn');--> statement-breakpoint
CREATE TYPE "public"."file_visibility" AS ENUM('public', 'private', 'unlisted');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('image', 'video', 'metadata', 'thumbnail', 'transcode');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."storage_provider_type" AS ENUM('s3', 'minio', 'local');--> statement-breakpoint
CREATE TYPE "public"."variant_type" AS ENUM('thumbnail', 'webp', 'avif', 'medium', 'large', 'xlarge', 'preview-frame', 'thumbnail-video', 'preview-video');--> statement-breakpoint
CREATE TABLE "download_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"variant_id" uuid,
	"ip_address" varchar(45),
	"user_agent" text,
	"user_id" integer,
	"bytes_downloaded" bigint,
	"download_method" "download_method",
	"referer" text,
	"downloaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_duplicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_file_id" uuid NOT NULL,
	"duplicate_file_id" uuid NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"detection_method" "detection_method" DEFAULT 'sha256' NOT NULL,
	"similarity_score" real,
	"is_confirmed" boolean DEFAULT false,
	"confirmed_by" integer,
	"confirmed_at" timestamp,
	CONSTRAINT "file_duplicates_unique" UNIQUE("original_file_id","duplicate_file_id"),
	CONSTRAINT "file_duplicates_different_check" CHECK ("file_duplicates"."original_file_id" != "file_duplicates"."duplicate_file_id"),
	CONSTRAINT "file_duplicates_similarity_check" CHECK ("file_duplicates"."similarity_score" IS NULL OR ("file_duplicates"."similarity_score" >= 0 AND "file_duplicates"."similarity_score" <= 1))
);
--> statement-breakpoint
CREATE TABLE "file_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"metadata" jsonb NOT NULL,
	"extracted_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"variant_type" "variant_type" NOT NULL,
	"variant_key" varchar(500) NOT NULL,
	"storage_provider_id" integer NOT NULL,
	"size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"quality" integer,
	"format" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "file_variants_key_provider_unique" UNIQUE("variant_key","storage_provider_id"),
	CONSTRAINT "file_variants_size_check" CHECK ("file_variants"."size" >= 0),
	CONSTRAINT "file_variants_quality_check" CHECK ("file_variants"."quality" IS NULL OR ("file_variants"."quality" >= 1 AND "file_variants"."quality" <= 100))
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_provider_id" integer NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"storage_bucket" varchar(255),
	"file_name" varchar(255) NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"file_extension" varchar(50),
	"mime_type" varchar(100) NOT NULL,
	"size" bigint NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"checksum" varchar(64),
	"width" integer,
	"height" integer,
	"aspect_ratio" varchar(20),
	"duration" integer,
	"bitrate" integer,
	"frame_rate" integer,
	"has_transparency" boolean DEFAULT false,
	"dominant_color" varchar(7),
	"color_palette" text,
	"streaming_url" text,
	"subtitle_keys" text,
	"alt" text,
	"title" text,
	"caption" text,
	"description" text,
	"transcript" text,
	"folder" varchar(255),
	"folder_id" uuid,
	"tags" text,
	"reference_count" integer DEFAULT 1 NOT NULL,
	"is_orphaned" boolean DEFAULT false,
	"orphaned_at" timestamp,
	"is_processed" boolean DEFAULT false,
	"processing_status" "processing_status",
	"processing_error" text,
	"processing_attempts" integer DEFAULT 0,
	"ai_generated_tags" text,
	"ai_description" text,
	"object_detection" text,
	"face_detection" text,
	"nsfw_score" real,
	"is_nsfw" boolean DEFAULT false,
	"visibility" "file_visibility" DEFAULT 'public',
	"download_password" text,
	"uploaded_by" integer,
	"external_id" varchar(255),
	"external_provider" varchar(100),
	"cdn_url" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_provider_unique" UNIQUE("storage_key","storage_provider_id"),
	CONSTRAINT "files_hash_unique" UNIQUE("file_hash"),
	CONSTRAINT "files_reference_count_check" CHECK ("files"."reference_count" >= 0),
	CONSTRAINT "files_size_check" CHECK ("files"."size" >= 0),
	CONSTRAINT "files_processing_attempts_check" CHECK ("files"."processing_attempts" >= 0),
	CONSTRAINT "files_nsfw_score_check" CHECK ("files"."nsfw_score" IS NULL OR ("files"."nsfw_score" >= 0 AND "files"."nsfw_score" <= 1))
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"job_type" "job_type" NOT NULL,
	"status" "processing_status" DEFAULT 'pending' NOT NULL,
	"bullmq_job_id" varchar(255),
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"progress" integer,
	"priority" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	CONSTRAINT "processing_jobs_retry_count_check" CHECK ("processing_jobs"."retry_count" >= 0),
	CONSTRAINT "processing_jobs_progress_check" CHECK ("processing_jobs"."progress" IS NULL OR ("processing_jobs"."progress" >= 0 AND "processing_jobs"."progress" <= 100))
);
--> statement-breakpoint
CREATE TABLE "storage_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "storage_provider_type" NOT NULL,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "storage_providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_variant_id_file_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."file_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_duplicates" ADD CONSTRAINT "file_duplicates_original_file_id_files_id_fk" FOREIGN KEY ("original_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_duplicates" ADD CONSTRAINT "file_duplicates_duplicate_file_id_files_id_fk" FOREIGN KEY ("duplicate_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_variants" ADD CONSTRAINT "file_variants_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_variants" ADD CONSTRAINT "file_variants_storage_provider_id_storage_providers_id_fk" FOREIGN KEY ("storage_provider_id") REFERENCES "public"."storage_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_storage_provider_id_storage_providers_id_fk" FOREIGN KEY ("storage_provider_id") REFERENCES "public"."storage_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "download_logs_file_id_idx" ON "download_logs" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "download_logs_variant_id_idx" ON "download_logs" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "download_logs_downloaded_at_idx" ON "download_logs" USING btree ("downloaded_at");--> statement-breakpoint
CREATE INDEX "download_logs_ip_address_idx" ON "download_logs" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "download_logs_user_id_idx" ON "download_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "download_logs_file_date_idx" ON "download_logs" USING btree ("file_id","downloaded_at");--> statement-breakpoint
CREATE INDEX "file_duplicates_original_idx" ON "file_duplicates" USING btree ("original_file_id");--> statement-breakpoint
CREATE INDEX "file_duplicates_duplicate_idx" ON "file_duplicates" USING btree ("duplicate_file_id");--> statement-breakpoint
CREATE INDEX "file_metadata_file_id_idx" ON "file_metadata" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "file_variants_file_id_idx" ON "file_variants" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "file_variants_type_idx" ON "file_variants" USING btree ("variant_type");--> statement-breakpoint
CREATE INDEX "file_variants_storage_provider_idx" ON "file_variants" USING btree ("storage_provider_id");--> statement-breakpoint
CREATE INDEX "file_variants_file_type_idx" ON "file_variants" USING btree ("file_id","variant_type");--> statement-breakpoint
CREATE INDEX "files_file_hash_idx" ON "files" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "files_storage_provider_idx" ON "files" USING btree ("storage_provider_id");--> statement-breakpoint
CREATE INDEX "files_mime_type_idx" ON "files" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "files_deleted_at_idx" ON "files" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "files_folder_id_idx" ON "files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "files_uploaded_by_idx" ON "files" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "files_processing_status_idx" ON "files" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "files_visibility_idx" ON "files" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "files_is_orphaned_idx" ON "files" USING btree ("is_orphaned");--> statement-breakpoint
CREATE INDEX "processing_jobs_file_id_idx" ON "processing_jobs" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "processing_jobs_job_type_idx" ON "processing_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "processing_jobs_bullmq_job_id_idx" ON "processing_jobs" USING btree ("bullmq_job_id");--> statement-breakpoint
CREATE INDEX "processing_jobs_file_status_idx" ON "processing_jobs" USING btree ("file_id","status");--> statement-breakpoint
CREATE INDEX "storage_providers_type_idx" ON "storage_providers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "storage_providers_active_idx" ON "storage_providers" USING btree ("is_active");