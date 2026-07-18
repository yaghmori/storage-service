-- Multi-tenant orgs + admin auth for storage-service.
-- Safe to run on empty DBs; for existing data, backfill default org first.

CREATE TYPE "public"."org_status" AS ENUM('active', 'suspended');

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(255) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "status" "org_status" DEFAULT 'active' NOT NULL,
  "external_ref" varchar(255),
  "logo_url" varchar(500),
  "frontend_base_url" varchar(500),
  "custom_domain" varchar(255),
  "primary_color" varchar(50),
  "secondary_color" varchar(50),
  "support_email" varchar(255),
  "privacy_url" varchar(500),
  "terms_url" varchar(500),
  "app_base_url" varchar(500),
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "role" varchar(50) DEFAULT 'admin' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "last_login_at" timestamp
);

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "service_name" varchar(255) NOT NULL,
  "key_hash" varchar(255) NOT NULL,
  "permissions" json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp,
  "is_active" boolean DEFAULT true NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_org_id_service_name_unique" ON "api_keys" ("org_id","service_name");

-- Ensure default org exists for backfill
INSERT INTO "organizations" ("slug", "name", "status")
SELECT 'default', 'Default', 'active'
WHERE NOT EXISTS (SELECT 1 FROM "organizations" WHERE "slug" = 'default');

-- Add org_id columns (nullable first for backfill)
ALTER TABLE "storage_providers" ADD COLUMN IF NOT EXISTS "org_id" uuid;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "org_id" uuid;
ALTER TABLE "processing_jobs" ADD COLUMN IF NOT EXISTS "org_id" uuid;
ALTER TABLE "download_logs" ADD COLUMN IF NOT EXISTS "org_id" uuid;
ALTER TABLE "file_duplicates" ADD COLUMN IF NOT EXISTS "org_id" uuid;

UPDATE "storage_providers" SET "org_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'default' LIMIT 1) WHERE "org_id" IS NULL;
UPDATE "files" SET "org_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'default' LIMIT 1) WHERE "org_id" IS NULL;
UPDATE "processing_jobs" pj SET "org_id" = f."org_id" FROM "files" f WHERE pj."file_id" = f."id" AND pj."org_id" IS NULL;
UPDATE "download_logs" dl SET "org_id" = f."org_id" FROM "files" f WHERE dl."file_id" = f."id" AND dl."org_id" IS NULL;
UPDATE "file_duplicates" fd SET "org_id" = f."org_id" FROM "files" f WHERE fd."original_file_id" = f."id" AND fd."org_id" IS NULL;

ALTER TABLE "storage_providers" ALTER COLUMN "org_id" SET NOT NULL;
ALTER TABLE "files" ALTER COLUMN "org_id" SET NOT NULL;
ALTER TABLE "processing_jobs" ALTER COLUMN "org_id" SET NOT NULL;
ALTER TABLE "download_logs" ALTER COLUMN "org_id" SET NOT NULL;
ALTER TABLE "file_duplicates" ALTER COLUMN "org_id" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "storage_providers" ADD CONSTRAINT "storage_providers_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "files" ADD CONSTRAINT "files_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "file_duplicates" ADD CONSTRAINT "file_duplicates_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Replace global name unique with per-org
ALTER TABLE "storage_providers" DROP CONSTRAINT IF EXISTS "storage_providers_name_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "storage_providers_org_id_name_unique" ON "storage_providers" ("org_id","name");

-- Replace global hash unique with per-org
ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "files_hash_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "files_org_id_hash_unique" ON "files" ("org_id","file_hash");
