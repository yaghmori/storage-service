ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar" text;
