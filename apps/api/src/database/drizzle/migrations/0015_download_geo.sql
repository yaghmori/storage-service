-- Geo enrichment for download analytics (region map, country filters)

ALTER TABLE "download_logs" ADD COLUMN IF NOT EXISTS "country_code" varchar(2);
ALTER TABLE "download_logs" ADD COLUMN IF NOT EXISTS "region_code" varchar(8);
ALTER TABLE "download_logs" ADD COLUMN IF NOT EXISTS "city" varchar(120);
ALTER TABLE "download_logs" ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6);
ALTER TABLE "download_logs" ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6);

CREATE INDEX IF NOT EXISTS "download_logs_org_country_idx" ON "download_logs" ("org_id", "country_code");
CREATE INDEX IF NOT EXISTS "download_logs_org_downloaded_at_idx" ON "download_logs" ("org_id", "downloaded_at");
