-- Fase 6.4A: fundação dos sites individuais de corretores.
-- Somente criação de tabelas; nenhuma tabela existente é alterada.

-- Perfil profissional (identidade pública do corretor). Um por usuário; dados de autenticação
-- continuam em admin_users. O vínculo com o perfil BROKER é validado pelo serviço.
CREATE TABLE IF NOT EXISTS "broker_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE RESTRICT,
	"display_name" varchar(120) NOT NULL,
	"professional_title" varchar(120),
	"biography" text,
	"profile_image_url" text,
	"whatsapp" varchar(20),
	"phone" varchar(20),
	"email_public" varchar(320),
	-- Dados profissionais separados; preenchido NÃO significa verificado.
	"creci" varchar(20),
	"creci_verified_at" timestamp with time zone,
	"vista_broker_code" varchar(40),
	"vista_broker_code_verified_at" timestamp with time zone,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL CHECK (jsonb_typeof("specialties") = 'array'),
	"service_regions" jsonb DEFAULT '[]'::jsonb NOT NULL CHECK (jsonb_typeof("service_regions") = 'array'),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "broker_profiles_user_unique" ON "broker_profiles" USING btree ("user_id");
--> statement-breakpoint

-- Site do corretor. No máximo um por perfil nesta fase; nenhum site nasce publicado.
CREATE TABLE IF NOT EXISTS "broker_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_profile_id" uuid NOT NULL REFERENCES "broker_profiles"("id") ON DELETE RESTRICT,
	"subdomain" varchar(30) NOT NULL CHECK ("subdomain" ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$' AND "subdomain" NOT LIKE '%--%'),
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL CHECK ("status" IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'SUSPENDED')),
	"headline" varchar(160),
	"subtitle" varchar(300),
	"hero_image_url" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL CHECK (jsonb_typeof("settings") = 'object'),
	"submitted_for_review_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
	"published_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	-- Publicado exige aprovação registrada.
	CONSTRAINT "broker_sites_published_requires_approval" CHECK ("status" <> 'PUBLISHED' OR ("approved_at" IS NOT NULL AND "published_at" IS NOT NULL)),
	CONSTRAINT "broker_sites_suspended_has_date" CHECK ("status" <> 'SUSPENDED' OR "suspended_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "broker_sites_profile_unique" ON "broker_sites" USING btree ("broker_profile_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "broker_sites_subdomain_unique" ON "broker_sites" USING btree ("subdomain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "broker_sites_status_idx" ON "broker_sites" USING btree ("status");
--> statement-breakpoint

-- Seleção de imóveis da curadoria por site. Não duplica dados comerciais.
-- Remover a associação não remove o imóvel; remover o imóvel da curadoria remove as associações.
CREATE TABLE IF NOT EXISTS "broker_site_properties" (
	"broker_site_id" uuid NOT NULL REFERENCES "broker_sites"("id") ON DELETE CASCADE,
	"curated_property_id" uuid NOT NULL REFERENCES "curated_properties"("id") ON DELETE CASCADE,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL CHECK ("sort_order" >= 0),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_site_properties_pk" PRIMARY KEY ("broker_site_id", "curated_property_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "broker_site_properties_property_idx" ON "broker_site_properties" USING btree ("curated_property_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "broker_site_properties_order_idx" ON "broker_site_properties" USING btree ("broker_site_id", "sort_order");
