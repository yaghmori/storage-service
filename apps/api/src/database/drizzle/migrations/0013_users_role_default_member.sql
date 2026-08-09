-- New users (including invite accepts) must not become platform super-admins by default.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member';
