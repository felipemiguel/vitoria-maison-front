-- Fase 6.4D: origem e atribuição de leads por corretor. Somente acréscimos em tabelas existentes (sem CRM paralelo).

ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "source" varchar(20) NOT NULL DEFAULT 'MAISON_SITE' CHECK ("source" IN ('MAISON_SITE', 'BROKER_SITE'));
--> statement-breakpoint
-- SET NULL preserva o lead (e sua origem textual) mesmo se o site/usuário for removido.
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "broker_site_id" uuid REFERENCES "broker_sites"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "broker_user_id" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL;
--> statement-breakpoint
-- Hostname e caminho no momento do envio: o histórico sobrevive a uma troca de subdomínio.
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "source_hostname" varchar(253);
--> statement-breakpoint
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "source_path" varchar(300);
--> statement-breakpoint
-- Código Vista do corretor no momento do envio (esperado) e o código informado pela resposta do Vista.
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "vista_broker_code_requested" varchar(40);
--> statement-breakpoint
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "vista_broker_code_returned" varchar(40);
--> statement-breakpoint
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "assignment_status" varchar(20) NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK ("assignment_status" IN ('NOT_APPLICABLE', 'PENDING', 'CONFIRMED', 'MISMATCH', 'UNVERIFIED'));
--> statement-breakpoint
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "assignment_checked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "lead_submissions" ADD COLUMN IF NOT EXISTS "assignment_checked_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "lead_submissions" ADD CONSTRAINT "lead_submissions_source_consistency" CHECK (
  ("source" = 'MAISON_SITE' AND "broker_site_id" IS NULL AND "broker_user_id" IS NULL AND "assignment_status" = 'NOT_APPLICABLE')
  OR ("source" = 'BROKER_SITE' AND "assignment_status" <> 'NOT_APPLICABLE')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_submissions_broker_site_idx" ON "lead_submissions" ("broker_site_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_submissions_broker_user_idx" ON "lead_submissions" ("broker_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_submissions_assignment_idx" ON "lead_submissions" ("assignment_status", "created_at");
--> statement-breakpoint
-- A origem de um lead é imutável. Única exceção: o FK ON DELETE SET NULL pode anular site/usuário.
CREATE OR REPLACE FUNCTION "lead_submissions_origin_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."source" IS DISTINCT FROM OLD."source"
    OR NEW."source_hostname" IS DISTINCT FROM OLD."source_hostname"
    OR NEW."source_path" IS DISTINCT FROM OLD."source_path"
    OR NEW."source_page" IS DISTINCT FROM OLD."source_page"
    OR NEW."vista_broker_code_requested" IS DISTINCT FROM OLD."vista_broker_code_requested"
    OR (NEW."broker_site_id" IS DISTINCT FROM OLD."broker_site_id" AND NEW."broker_site_id" IS NOT NULL)
    OR (NEW."broker_user_id" IS DISTINCT FROM OLD."broker_user_id" AND NEW."broker_user_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'A origem de um lead não pode ser alterada.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "lead_submissions_origin_immutable" ON "lead_submissions";
--> statement-breakpoint
CREATE TRIGGER "lead_submissions_origin_immutable" BEFORE UPDATE ON "lead_submissions" FOR EACH ROW EXECUTE FUNCTION "lead_submissions_origin_immutable"();
--> statement-breakpoint
-- Histórico de tentativas: referência e corretor informados pelo Vista em cada tentativa.
ALTER TABLE "lead_delivery_attempts" ADD COLUMN IF NOT EXISTS "vista_reference" varchar(200);
--> statement-breakpoint
ALTER TABLE "lead_delivery_attempts" ADD COLUMN IF NOT EXISTS "vista_broker_code_returned" varchar(40);
