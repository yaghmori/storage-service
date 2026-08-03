-- Pluggable processing clean-slate reshape
-- Extends processing_status, slims files, opens variant_type / processor_key,
-- drops file_metadata + job_type, adds processor_backends / org_processors / file_processor_results.

ALTER TYPE "public"."processing_status" ADD VALUE IF NOT EXISTS 'partial';
--> statement-breakpoint
ALTER TYPE "public"."processing_status" ADD VALUE IF NOT EXISTS 'skipped';
--> statement-breakpoint

-- processor_backends
CREATE TABLE IF NOT EXISTS "processor_backends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"kind" varchar(64) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processor_backends" ADD CONSTRAINT "processor_backends_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processor_backends_org_id_idx" ON "processor_backends" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processor_backends_kind_idx" ON "processor_backends" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processor_backends_active_idx" ON "processor_backends" USING btree ("is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "processor_backends_org_id_name_unique" ON "processor_backends" USING btree ("org_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "processor_backends_org_kind_default_unique" ON "processor_backends" USING btree ("org_id","kind") WHERE "is_default" = true;
--> statement-breakpoint

-- org_processors
CREATE TABLE IF NOT EXISTS "org_processors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"processor_key" varchar(128) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"mime_include" text[],
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"backend_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_processors" ADD CONSTRAINT "org_processors_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "org_processors" ADD CONSTRAINT "org_processors_backend_id_processor_backends_id_fk" FOREIGN KEY ("backend_id") REFERENCES "public"."processor_backends"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_processors_org_id_idx" ON "org_processors" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_processors_processor_key_idx" ON "org_processors" USING btree ("processor_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_processors_org_id_processor_key_unique" ON "org_processors" USING btree ("org_id","processor_key");
--> statement-breakpoint

-- processing_jobs: add processor_key / backend / parameters before dropping job_type
ALTER TABLE "processing_jobs" ADD COLUMN IF NOT EXISTS "processor_key" varchar(128);
--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN IF NOT EXISTS "backend_id" uuid;
--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN IF NOT EXISTS "parameters" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint

-- Backfill processor_key from legacy job_type
UPDATE "processing_jobs"
SET "processor_key" = CASE "job_type"::text
  WHEN 'image' THEN 'image.variants'
  WHEN 'video' THEN 'video.preview'
  WHEN 'metadata' THEN 'metadata.exif'
  WHEN 'thumbnail' THEN 'image.variants'
  WHEN 'transcode' THEN 'video.preview'
  ELSE 'image.variants'
END
WHERE "processor_key" IS NULL;
--> statement-breakpoint
ALTER TABLE "processing_jobs" ALTER COLUMN "processor_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "processing_jobs" DROP CONSTRAINT IF EXISTS "processing_jobs_backend_id_processor_backends_id_fk";
--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_backend_id_processor_backends_id_fk" FOREIGN KEY ("backend_id") REFERENCES "public"."processor_backends"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "processing_jobs_job_type_idx";
--> statement-breakpoint
ALTER TABLE "processing_jobs" DROP COLUMN IF EXISTS "job_type";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processing_jobs_processor_key_idx" ON "processing_jobs" USING btree ("processor_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "processing_jobs_file_processor_inflight_unique" ON "processing_jobs" USING btree ("file_id","processor_key") WHERE "status" IN ('pending', 'processing');
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."job_type";
--> statement-breakpoint

-- file_processor_results
CREATE TABLE IF NOT EXISTS "file_processor_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"processor_key" varchar(128) NOT NULL,
	"status" "processing_status" DEFAULT 'pending' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"backend_id" uuid,
	"backend_kind" varchar(64),
	"model" varchar(255),
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"job_id" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_processor_results" ADD CONSTRAINT "file_processor_results_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "file_processor_results" ADD CONSTRAINT "file_processor_results_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "file_processor_results" ADD CONSTRAINT "file_processor_results_backend_id_processor_backends_id_fk" FOREIGN KEY ("backend_id") REFERENCES "public"."processor_backends"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "file_processor_results" ADD CONSTRAINT "file_processor_results_job_id_processing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."processing_jobs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_processor_results_org_id_idx" ON "file_processor_results" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_processor_results_file_id_idx" ON "file_processor_results" USING btree ("file_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_processor_results_processor_key_idx" ON "file_processor_results" USING btree ("processor_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_processor_results_org_processor_idx" ON "file_processor_results" USING btree ("org_id","processor_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "file_processor_results_file_processor_unique" ON "file_processor_results" USING btree ("file_id","processor_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_processor_results_ai_nsfw_idx" ON "file_processor_results" ((("data"->>'isNsfw'))) WHERE "processor_key" = 'ai.vision';
--> statement-breakpoint

-- Migrate EXIF sidecar into file_processor_results
INSERT INTO "file_processor_results" ("org_id", "file_id", "processor_key", "status", "schema_version", "data", "processed_at", "created_at", "updated_at")
SELECT f."org_id", fm."file_id", 'metadata.exif', 'completed', 1, fm."metadata", fm."extracted_at", fm."extracted_at", fm."updated_at"
FROM "file_metadata" fm
INNER JOIN "files" f ON f."id" = fm."file_id"
ON CONFLICT ("file_id", "processor_key") DO NOTHING;
--> statement-breakpoint
DROP TABLE IF EXISTS "file_metadata";
--> statement-breakpoint

-- Open file_variants.variant_type (enum → varchar)
ALTER TABLE "file_variants" ALTER COLUMN "variant_type" TYPE varchar(64) USING "variant_type"::text;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."variant_type";
--> statement-breakpoint

-- Slim files: drop orphan / wrong-layer columns
ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "files_nsfw_score_check";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "files_processing_attempts_check";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "aspect_ratio";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "bitrate";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "frame_rate";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "has_transparency";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "dominant_color";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "color_palette";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "streaming_url";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "subtitle_keys";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "transcript";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "is_processed";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "processing_attempts";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "ai_generated_tags";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "ai_description";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "object_detection";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "face_detection";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "nsfw_score";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "is_nsfw";
