ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "perceptual_hash" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_org_perceptual_hash_idx" ON "files" ("org_id", "perceptual_hash");
