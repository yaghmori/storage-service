-- Audit columns: which admin user created/updated each admin-mutable resource

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "storage_providers" ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "storage_providers" ADD COLUMN IF NOT EXISTS "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "processor_backends" ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "processor_backends" ADD COLUMN IF NOT EXISTS "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
