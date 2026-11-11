CREATE TABLE "admin_bulk_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" uuid NOT NULL,
  "idempotency_key" varchar(200) NOT NULL,
  "requested_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'RUNNING' NOT NULL,
  "total" integer DEFAULT 0 NOT NULL,
  "imported" integer DEFAULT 0 NOT NULL,
  "existing" integer DEFAULT 0 NOT NULL,
  "failed" integer DEFAULT 0 NOT NULL,
  "results" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
ALTER TABLE "admin_bulk_imports" ADD CONSTRAINT "admin_bulk_imports_admin_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id");
CREATE UNIQUE INDEX "admin_bulk_imports_idempotency_unique" ON "admin_bulk_imports" ("admin_user_id", "idempotency_key");
CREATE INDEX "admin_bulk_imports_admin_idx" ON "admin_bulk_imports" ("admin_user_id", "started_at");
