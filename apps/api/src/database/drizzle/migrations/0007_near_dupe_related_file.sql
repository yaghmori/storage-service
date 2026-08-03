ALTER TABLE "file_duplicates" ADD COLUMN IF NOT EXISTS "duplicate_file_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "file_duplicates"
    ADD CONSTRAINT "file_duplicates_duplicate_file_id_files_id_fk"
    FOREIGN KEY ("duplicate_file_id") REFERENCES "public"."files"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_duplicates_duplicate_file_idx"
  ON "file_duplicates" ("duplicate_file_id");
