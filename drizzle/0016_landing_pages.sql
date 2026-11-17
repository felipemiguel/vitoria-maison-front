-- Landing pages de imóvel (tráfego pago e divulgação). Uma página = um imóvel da curadoria.
-- Dados comerciais (preço, área, fotos, situação) continuam vindo do snapshot; aqui ficam só os textos e a configuração.
CREATE TABLE IF NOT EXISTS "landing_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") >= 3),
	"name" varchar(120) NOT NULL,
	"curated_property_id" uuid NOT NULL REFERENCES "curated_properties"("id") ON DELETE RESTRICT,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hero_image_asset_id" uuid,
	"whatsapp_number" varchar(20),
	"whatsapp_message" varchar(300),
	"seo_title" varchar(70),
	"seo_description" varchar(170),
	"first_published_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
	"updated_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landing_pages_published_consistency" CHECK ("status" <> 'PUBLISHED' OR ("published_at" IS NOT NULL AND "first_published_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "landing_pages_slug_unique" ON "landing_pages" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_pages_property_idx" ON "landing_pages" USING btree ("curated_property_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_pages_status_idx" ON "landing_pages" USING btree ("status", "updated_at");
--> statement-breakpoint
-- Imagem de topo enviada pelo painel (WebP já tratado).
ALTER TABLE "media_assets" DROP CONSTRAINT IF EXISTS "media_assets_kind_check";
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_kind_check" CHECK ("kind" IN ('BROKER_PROFILE_PHOTO', 'BROKER_SITE_HERO', 'LANDING_PAGE_HERO'));
--> statement-breakpoint
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_hero_image_fk" FOREIGN KEY ("hero_image_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL;
