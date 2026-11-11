CREATE TYPE "lead_type" AS ENUM ('PROPERTY_INTEREST', 'GENERAL_CONTACT', 'OWNER_CONTACT', 'INVESTMENT_CONSULTING');
CREATE TYPE "lead_delivery_status" AS ENUM ('PENDING', 'DELIVERED', 'MOCKED', 'FAILED', 'UNKNOWN');
CREATE TYPE "lead_attempt_status" AS ENUM ('DELIVERED', 'MOCKED', 'FAILED', 'UNKNOWN');

CREATE TABLE "lead_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" "lead_type" NOT NULL,
  "property_id" uuid,
  "property_vista_code" varchar(80),
  "name" varchar(160) NOT NULL,
  "email" varchar(320),
  "phone" varchar(40),
  "message" text,
  "source_page" varchar(300) NOT NULL,
  "delivery_status" "lead_delivery_status" DEFAULT 'PENDING' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "vista_reference" varchar(200),
  "last_error_code" varchar(80),
  "submission_key" varchar(100) NOT NULL,
  "deduplication_hash" varchar(64) NOT NULL,
  "session_hash" varchar(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lead_delivery_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_submission_id" uuid NOT NULL,
  "attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" "lead_attempt_status" NOT NULL,
  "error_code" varchar(80),
  "duration_ms" integer NOT NULL
);

ALTER TABLE "lead_submissions" ADD CONSTRAINT "lead_submissions_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "curated_properties"("id") ON DELETE SET NULL;
ALTER TABLE "lead_delivery_attempts" ADD CONSTRAINT "lead_delivery_attempts_lead_submission_id_fk" FOREIGN KEY ("lead_submission_id") REFERENCES "lead_submissions"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX "lead_submissions_submission_key_unique" ON "lead_submissions" ("submission_key");
CREATE INDEX "lead_submissions_created_idx" ON "lead_submissions" ("created_at");
CREATE INDEX "lead_submissions_status_idx" ON "lead_submissions" ("delivery_status", "created_at");
CREATE INDEX "lead_submissions_property_idx" ON "lead_submissions" ("property_id", "created_at");
CREATE INDEX "lead_submissions_deduplication_idx" ON "lead_submissions" ("deduplication_hash", "created_at");
CREATE INDEX "lead_submissions_session_idx" ON "lead_submissions" ("session_hash", "created_at");
CREATE INDEX "lead_delivery_attempts_lead_idx" ON "lead_delivery_attempts" ("lead_submission_id", "attempted_at");
