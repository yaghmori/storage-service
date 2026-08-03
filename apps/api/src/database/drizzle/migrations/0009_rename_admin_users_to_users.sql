-- Rename admin_users → users (idempotent for DBs that already applied 0001 as admin_users).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    ALTER TABLE "admin_users" RENAME TO "users";
  END IF;
END $$;

ALTER INDEX IF EXISTS "admin_users_email_idx" RENAME TO "users_email_idx";
ALTER INDEX IF EXISTS "admin_users_email_active_idx" RENAME TO "users_email_active_idx";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_users_pkey' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE "users" RENAME CONSTRAINT "admin_users_pkey" TO "users_pkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_users_email_key' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE "users" RENAME CONSTRAINT "admin_users_email_key" TO "users_email_key";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_users_email_unique' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE "users" RENAME CONSTRAINT "admin_users_email_unique" TO "users_email_unique";
  END IF;
END $$;
