ALTER TABLE "collections" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;

CREATE TABLE "admin_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" uuid NOT NULL,
  "entity_type" varchar(40) NOT NULL,
  "entity_id" uuid NOT NULL,
  "action" varchar(80) NOT NULL,
  "before_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "after_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_admin_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id");
CREATE INDEX "admin_audit_entity_idx" ON "admin_audit_events" ("entity_type", "entity_id", "created_at");
