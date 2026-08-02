ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "used_bytes" bigint DEFAULT 0 NOT NULL;-->statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "object_count" integer DEFAULT 0 NOT NULL;-->statement-breakpoint

-- Backfill: count all files that still occupy storage (active + soft-deleted).
UPDATE "organizations" AS o
SET
  "used_bytes" = COALESCE(u.total_bytes, 0),
  "object_count" = COALESCE(u.total_count, 0)
FROM (
  SELECT
    f."org_id",
    COALESCE(SUM(f."size"), 0)::bigint AS total_bytes,
    COUNT(*)::integer AS total_count
  FROM "files" f
  GROUP BY f."org_id"
) AS u
WHERE o."id" = u."org_id";
