CREATE TYPE "availability_status" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN');

ALTER TABLE "curated_properties" ADD COLUMN "availability_confirmed_at" timestamp with time zone;
ALTER TABLE "curated_properties" ADD COLUMN "availability_expires_at" timestamp with time zone;
ALTER TABLE "curated_properties" ADD COLUMN "availability_confirmed_by" varchar(160);
ALTER TABLE "curated_properties" ADD COLUMN "availability_confirmation_source" varchar(80);
ALTER TABLE "curated_properties" ADD COLUMN "publication_version" integer DEFAULT 0 NOT NULL;
UPDATE "curated_properties"
SET "published" = false, "publication_version" = "publication_version" + 1, "updated_at" = now()
WHERE "published" = true;

ALTER TABLE "property_snapshots" ADD COLUMN "source_purpose" varchar(160);
ALTER TABLE "property_snapshots" ALTER COLUMN "availability_status" DROP DEFAULT;
UPDATE "property_snapshots"
SET "availability_status" = 'UNKNOWN'
WHERE "availability_status" IS NULL OR "availability_status" NOT IN ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN');
ALTER TABLE "property_snapshots" ALTER COLUMN "availability_status" TYPE "availability_status"
USING "availability_status"::"availability_status";
ALTER TABLE "property_snapshots" ALTER COLUMN "availability_status" SET DEFAULT 'UNKNOWN';
ALTER TABLE "property_snapshots" ALTER COLUMN "availability_status" SET NOT NULL;

CREATE TABLE "property_publication_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "curated_property_id" uuid NOT NULL,
  "event_type" varchar(80) NOT NULL,
  "actor" varchar(160) NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "property_publication_events" ADD CONSTRAINT "property_publication_events_curated_property_id_fk"
FOREIGN KEY ("curated_property_id") REFERENCES "curated_properties"("id") ON DELETE CASCADE;
CREATE INDEX "property_publication_events_property_idx" ON "property_publication_events" ("curated_property_id", "created_at");
