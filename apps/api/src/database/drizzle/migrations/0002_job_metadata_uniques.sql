-- Dedupe sidecar metadata (keep newest per file), then enforce 1:1 with files.
DELETE FROM file_metadata a
USING file_metadata b
WHERE a.file_id = b.file_id
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS file_metadata_file_id_unique
  ON file_metadata (file_id);

-- Dedupe processing job rows that share the same BullMQ id (race leftovers).
DELETE FROM processing_jobs a
USING processing_jobs b
WHERE a.bullmq_job_id IS NOT NULL
  AND a.bullmq_job_id = b.bullmq_job_id
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS processing_jobs_bullmq_job_id_unique
  ON processing_jobs (bullmq_job_id)
  WHERE bullmq_job_id IS NOT NULL;

-- Backfill checksum from file_hash where missing.
UPDATE files
SET checksum = file_hash
WHERE checksum IS NULL
  AND file_hash IS NOT NULL;
