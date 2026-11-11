-- Arquivos de mídia enviados pelo painel, armazenados no próprio PostgreSQL (foto do corretor).
-- Imagens chegam já tratadas pelo servidor (recorte, redimensionamento, WebP, sem metadados/GPS).
CREATE TABLE IF NOT EXISTS "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(40) NOT NULL CHECK ("kind" IN ('BROKER_PROFILE_PHOTO')),
	"owner_user_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
	"content_type" varchar(60) NOT NULL CHECK ("content_type" IN ('image/webp')),
	"bytes" bytea NOT NULL,
	"size_bytes" integer NOT NULL CHECK ("size_bytes" > 0 AND "size_bytes" <= 2097152),
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"created_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_owner_idx" ON "media_assets" USING btree ("owner_user_id", "kind");
--> statement-breakpoint
-- Alteração aditiva: a foto enviada tem precedência sobre profile_image_url (mantida por compatibilidade).
ALTER TABLE "broker_profiles" ADD COLUMN IF NOT EXISTS "profile_image_asset_id" uuid REFERENCES "media_assets"("id") ON DELETE SET NULL;
