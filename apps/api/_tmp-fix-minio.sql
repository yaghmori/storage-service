UPDATE storage_providers
SET
  config = jsonb_set(config::jsonb, '{endpoint}', '"minio"')::json,
  updated_at = NOW()
WHERE type = 'minio'
  AND (config->>'endpoint') IN ('localhost', '127.0.0.1', 'http://localhost:9000', 'http://localhost');

SELECT name, type, is_active, is_default, config
FROM storage_providers
WHERE type = 'minio';
