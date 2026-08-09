CREATE TYPE "public"."org_member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."org_member_status" AS ENUM('active', 'invited');--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"role" "org_member_role" DEFAULT 'member' NOT NULL,
	"status" "org_member_status" DEFAULT 'invited' NOT NULL,
	"email" text NOT NULL,
	"token" text,
	"message" text,
	"invited_by_user_id" uuid,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_uq" ON "organization_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_email_uq" ON "organization_members" USING btree ("org_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_token_uq" ON "organization_members" USING btree ("token");--> statement-breakpoint
CREATE INDEX "organization_members_org_id_idx" ON "organization_members" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
-- Backfill: earliest active user becomes owner of every existing org (users never had org_id)
INSERT INTO "organization_members" ("org_id", "user_id", "role", "status", "email", "accepted_at", "created_at", "updated_at")
SELECT o."id", u."id", 'owner'::"org_member_role", 'active'::"org_member_status", lower(u."email"), now(), now(), now()
FROM "organizations" o
CROSS JOIN LATERAL (
  SELECT "id", "email"
  FROM "users"
  WHERE "is_active" = true
  ORDER BY "created_at" ASC
  LIMIT 1
) u
ON CONFLICT DO NOTHING;
