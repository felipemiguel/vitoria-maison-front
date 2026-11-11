-- Fase 6.4C: editor do site do corretor e revisão administrativa. Somente acréscimos.

-- Nova categoria de mídia: imagem de apresentação do site (mesmo pipeline seguro da foto profissional).
ALTER TABLE "media_assets" DROP CONSTRAINT IF EXISTS "media_assets_kind_check";
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_kind_check" CHECK ("kind" IN ('BROKER_PROFILE_PHOTO', 'BROKER_SITE_HERO'));
--> statement-breakpoint
ALTER TABLE "broker_sites" ADD COLUMN IF NOT EXISTS "hero_image_asset_id" uuid REFERENCES "media_assets"("id") ON DELETE SET NULL;
--> statement-breakpoint
-- Última decisão de revisão (não existe estado REJECTED: a devolução volta para DRAFT com justificativa).
ALTER TABLE "broker_sites" ADD COLUMN IF NOT EXISTS "last_review_decision" varchar(20) CHECK ("last_review_decision" IN ('APPROVED', 'RETURNED'));
--> statement-breakpoint
ALTER TABLE "broker_sites" ADD COLUMN IF NOT EXISTS "last_review_notes" text;
--> statement-breakpoint
ALTER TABLE "broker_sites" ADD COLUMN IF NOT EXISTS "last_reviewed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "broker_sites" ADD COLUMN IF NOT EXISTS "last_reviewed_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "broker_sites" ADD COLUMN IF NOT EXISTS "suspension_reason" text;
