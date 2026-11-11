-- Fase 6.4D (ajuste): leads recebidos pelos sites de corretores ANTES da 0014 ficaram como MAISON_SITE.
-- Até a 6.4C, o servidor marcava a origem como "/corretor/<subdomínio>/..." somente quando o envio vinha do
-- host do corretor (no domínio institucional esse prefixo enviado pelo navegador era descartado). Por isso o
-- prefixo é confiável para vincular esses leads ao site e ao corretor dono do site.
-- O gatilho de imutabilidade da origem é suspenso apenas durante esta correção pontual.
ALTER TABLE "lead_submissions" DISABLE TRIGGER "lead_submissions_origin_immutable";
--> statement-breakpoint
UPDATE "lead_submissions" AS l SET
  "source" = 'BROKER_SITE',
  "broker_site_id" = s."id",
  "broker_user_id" = p."user_id",
  "source_path" = COALESCE(NULLIF(substring(l."source_page" FROM '^/corretor/[a-z0-9-]+(/.*)$'), ''), '/'),
  "assignment_status" = CASE WHEN l."delivery_status" IN ('DELIVERED', 'MOCKED') THEN 'UNVERIFIED' ELSE 'PENDING' END
FROM "broker_sites" AS s
INNER JOIN "broker_profiles" AS p ON p."id" = s."broker_profile_id"
WHERE l."source" = 'MAISON_SITE'
  AND l."broker_site_id" IS NULL
  AND l."source_page" ~ '^/corretor/[a-z0-9-]+(/|$)'
  AND s."subdomain" = substring(l."source_page" FROM '^/corretor/([a-z0-9-]+)');
--> statement-breakpoint
ALTER TABLE "lead_submissions" ENABLE TRIGGER "lead_submissions_origin_immutable";
