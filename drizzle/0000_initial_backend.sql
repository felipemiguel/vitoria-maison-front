CREATE TYPE "publication_purpose" AS ENUM ('SALE', 'RENT', 'INVESTMENT');
CREATE TYPE "snapshot_sync_status" AS ENUM ('SUCCESS');
CREATE TYPE "sync_run_status" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

CREATE TABLE "curated_properties" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vista_code" varchar(80) NOT NULL,
  "slug" varchar(160) NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "featured_order" integer,
  "publication_purpose" "publication_purpose",
  "editorial_title" varchar(240),
  "editorial_description" text,
  "editorial_cover_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "property_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "curated_property_id" uuid NOT NULL,
  "external_code" varchar(80) NOT NULL,
  "category" varchar(80),
  "city" varchar(160) NOT NULL,
  "neighborhood" varchar(160) NOT NULL,
  "sale_price" numeric(14,2),
  "rental_price" numeric(14,2),
  "private_area" numeric(12,2),
  "total_area" numeric(12,2),
  "bedrooms" integer,
  "suites" integer,
  "parking_spaces" integer,
  "cover_image_url" text,
  "images" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "characteristics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "infrastructure" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "raw_category" varchar(160),
  "availability_status" varchar(80),
  "source_updated_at" timestamp with time zone,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sync_status" "snapshot_sync_status" DEFAULT 'SUCCESS' NOT NULL
);

CREATE TABLE "collections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(160) NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text,
  "cover_image_url" text,
  "published" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "collection_properties" (
  "collection_id" uuid NOT NULL,
  "curated_property_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "status" "sync_run_status" DEFAULT 'RUNNING' NOT NULL,
  "total_processed" integer DEFAULT 0 NOT NULL,
  "total_success" integer DEFAULT 0 NOT NULL,
  "total_failed" integer DEFAULT 0 NOT NULL,
  "error_summary" text
);

ALTER TABLE "property_snapshots" ADD CONSTRAINT "property_snapshots_curated_property_id_fk" FOREIGN KEY ("curated_property_id") REFERENCES "curated_properties"("id") ON DELETE CASCADE;
ALTER TABLE "collection_properties" ADD CONSTRAINT "collection_properties_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE;
ALTER TABLE "collection_properties" ADD CONSTRAINT "collection_properties_curated_property_id_fk" FOREIGN KEY ("curated_property_id") REFERENCES "curated_properties"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "curated_properties_vista_code_unique" ON "curated_properties" ("vista_code");
CREATE UNIQUE INDEX "curated_properties_slug_unique" ON "curated_properties" ("slug");
CREATE INDEX "curated_properties_publication_idx" ON "curated_properties" ("published", "featured", "featured_order");
CREATE UNIQUE INDEX "property_snapshots_curated_unique" ON "property_snapshots" ("curated_property_id");
CREATE UNIQUE INDEX "property_snapshots_external_code_unique" ON "property_snapshots" ("external_code");
CREATE INDEX "property_snapshots_search_idx" ON "property_snapshots" ("city", "neighborhood", "category");
CREATE INDEX "property_snapshots_availability_idx" ON "property_snapshots" ("availability_status", "sync_status");
CREATE UNIQUE INDEX "collections_slug_unique" ON "collections" ("slug");
CREATE UNIQUE INDEX "collection_properties_pair_unique" ON "collection_properties" ("collection_id", "curated_property_id");
CREATE INDEX "collection_properties_order_idx" ON "collection_properties" ("collection_id", "sort_order");

INSERT INTO "collections" ("slug", "name", "description", "published", "sort_order") VALUES
  ('jardins', 'Jardins', 'Arquitetura, conveniência e vida a pé.', false, 10),
  ('alto-padrao', 'Alto Padrão', 'Residências singulares em São Paulo.', false, 20),
  ('flats-investimento', 'Flats para Investimento', 'Curadoria para decisões conscientes.', false, 30),
  ('proximos-metro', 'Próximos ao Metrô', 'Mobilidade no centro das escolhas.', false, 40)
ON CONFLICT ("slug") DO NOTHING;
