ALTER TABLE "processing_jobs" ADD COLUMN IF NOT EXISTS "logs" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN IF NOT EXISTS "output" jsonb;
