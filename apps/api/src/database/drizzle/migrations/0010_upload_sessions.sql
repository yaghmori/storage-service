CREATE TABLE IF NOT EXISTS "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"storage_provider_id" uuid NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"storage_bucket" varchar(255),
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"declared_size" bigint NOT NULL,
	"multipart_upload_id" varchar(255),
	"part_size" integer,
	"skip_processing" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_storage_provider_id_storage_providers_id_fk" FOREIGN KEY ("storage_provider_id") REFERENCES "public"."storage_providers"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_org_id_idx" ON "upload_sessions" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_status_idx" ON "upload_sessions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_expires_at_idx" ON "upload_sessions" USING btree ("expires_at");
