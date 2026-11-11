-- Fase 6: usuários com múltiplos perfis (RBAC), convites, recuperação de senha e auditoria.
-- Migração incremental (expand): nenhuma tabela ou coluna existente é removida ou renomeada.
-- "admin_users" passa a ser a tabela única de usuários; o nome físico é mantido porque
-- admin_audit_events e admin_bulk_imports têm chaves estrangeiras para ela.
-- IDs, hashes de senha, status e last_login_at são preservados. Nenhum usuário é criado.

-- 1. Usuários: contas convidadas ainda não têm senha.
ALTER TABLE "admin_users" ALTER COLUMN "password_hash" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "invited_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "invitation_accepted_at" timestamp with time zone;
--> statement-breakpoint
-- Incrementada para revogar sessões JWT existentes (desativação, troca de senha, troca de e-mail).
-- Tokens antigos sem a versão são tratados como versão 0, então as sessões atuais continuam válidas.
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Controle otimista de concorrência para edições administrativas.
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- 2. Perfis.
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_code_unique" ON "roles" USING btree ("code");
--> statement-breakpoint
INSERT INTO "roles" ("code", "name", "description") VALUES
	('ADMIN', 'Administrador', 'Acesso administrativo e operacional completo, incluindo usuários e permissões.'),
	('MANAGER', 'Gestor', 'Operação de imóveis, importação, publicação, sincronização, coleções e leads.'),
	('BROKER', 'Corretor', 'Área pessoal do corretor. Preparado para o futuro site individual.')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
	"role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
	CONSTRAINT "user_roles_pk" PRIMARY KEY ("user_id", "role_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_role_idx" ON "user_roles" USING btree ("role_id");
--> statement-breakpoint
-- Todos os usuários existentes eram administradores: recebem o perfil ADMIN (inclusive os inativos,
-- que continuam sem acesso porque active=false).
INSERT INTO "user_roles" ("user_id", "role_id")
SELECT "u"."id", "r"."id" FROM "admin_users" "u" CROSS JOIN "roles" "r" WHERE "r"."code" = 'ADMIN'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- 3. Tokens de convite e de recuperação de senha. Somente o hash SHA-256 é armazenado.
CREATE TABLE IF NOT EXISTS "user_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
	"purpose" varchar(20) NOT NULL CHECK ("purpose" IN ('INVITE', 'PASSWORD_RESET')),
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_tokens_hash_unique" ON "user_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_tokens_user_purpose_idx" ON "user_tokens" USING btree ("user_id", "purpose");
--> statement-breakpoint

-- 4. Auditoria de acessos (somente inserção).
CREATE TABLE IF NOT EXISTS "user_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid REFERENCES "admin_users"("id") ON DELETE RESTRICT,
	"target_user_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE RESTRICT,
	"action" varchar(60) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_audit_target_idx" ON "user_audit_events" USING btree ("target_user_id", "created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "user_audit_events_immutable"() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'user_audit_events é somente inserção';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "user_audit_events_no_change" ON "user_audit_events";
--> statement-breakpoint
CREATE TRIGGER "user_audit_events_no_change" BEFORE UPDATE OR DELETE ON "user_audit_events"
	FOR EACH ROW EXECUTE FUNCTION "user_audit_events_immutable"();
--> statement-breakpoint

-- 5. Proteção do último ADMIN ativo, aplicada pelo banco no COMMIT (constraint trigger adiada).
-- O advisory lock serializa transações concorrentes: a segunda a confirmar recontagem já enxerga
-- a primeira e é rejeitada se não restar nenhum ADMIN ativo.
CREATE OR REPLACE FUNCTION "ensure_active_admin_remains"() RETURNS trigger AS $$
DECLARE
	affects_admin boolean := false;
	remaining integer;
BEGIN
	IF TG_TABLE_NAME = 'user_roles' THEN
		SELECT "code" = 'ADMIN' INTO affects_admin FROM "roles" WHERE "id" = OLD."role_id";
	ELSIF TG_TABLE_NAME = 'admin_users' THEN
		affects_admin := OLD."active" AND NOT NEW."active";
	END IF;
	IF NOT COALESCE(affects_admin, false) THEN
		RETURN NULL;
	END IF;
	PERFORM pg_advisory_xact_lock(hashtext('vitoria-maison:active-admins'));
	SELECT count(*) INTO remaining
	FROM "admin_users" "u"
	JOIN "user_roles" "ur" ON "ur"."user_id" = "u"."id"
	JOIN "roles" "r" ON "r"."id" = "ur"."role_id"
	WHERE "r"."code" = 'ADMIN' AND "u"."active";
	IF remaining = 0 THEN
		RAISE EXCEPTION 'LAST_ACTIVE_ADMIN' USING ERRCODE = 'P0001', HINT = 'O sistema precisa manter ao menos um ADMIN ativo.';
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "user_roles_keep_admin" ON "user_roles";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "user_roles_keep_admin" AFTER DELETE ON "user_roles"
	DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "ensure_active_admin_remains"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "admin_users_keep_admin" ON "admin_users";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "admin_users_keep_admin" AFTER UPDATE OF "active" ON "admin_users"
	DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "ensure_active_admin_remains"();
