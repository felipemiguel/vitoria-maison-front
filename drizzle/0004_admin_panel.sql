ALTER TABLE "curated_properties" ADD COLUMN "last_sync_status" varchar(20) DEFAULT 'NEVER' NOT NULL;
ALTER TABLE "curated_properties" ADD COLUMN "last_sync_error" text;
ALTER TABLE "curated_properties" ADD COLUMN "last_sync_attempt_at" timestamp with time zone;

UPDATE "curated_properties" AS curated
SET "last_sync_status" = 'SUCCESS',
    "last_sync_attempt_at" = snapshot."fetched_at"
FROM "property_snapshots" AS snapshot
WHERE snapshot."curated_property_id" = curated."id";

CREATE TABLE "admin_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(160) NOT NULL,
  "email" varchar(320) NOT NULL,
  "password_hash" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_login_at" timestamp with time zone
);

CREATE UNIQUE INDEX "admin_users_email_unique" ON "admin_users" ("email");

CREATE TABLE "admin_login_attempts" (
  "attempt_key" varchar(64) PRIMARY KEY NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "blocked_until" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
