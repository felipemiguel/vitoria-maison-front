import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminUsers, brokerProfiles, brokerSites, roles, userRoles } from "@/database/schema";
import type { LeadSubmissionService } from "@/features/leads/lead-submission-service";
import type { LeadOrigin, LeadSubmissionResult } from "@/features/leads/types";
import type { BrokerSitesConfig } from "./config";
import { normalizeHost, resolveHost } from "./hosts";
import { isPubliclyVisible } from "./status";

type Db = NodePgDatabase<typeof schema>;

/** Origem recusada (site inexistente, não publicado, suspenso, formulário desligado ou host inválido). */
export class LeadOriginError extends Error {}

export const BROKER_SITE_UNAVAILABLE = "Este site não está recebendo contatos no momento.";
export const BROKER_LEADS_DISABLED = "O formulário deste site ainda não está disponível. Use o WhatsApp ou o e-mail informados na página.";

/** Caminho de origem informado pelo formulário, sem o prefixo interno (só rótulo; nunca decide o site). */
function cleanPath(clientSourcePage: string): string {
  const path = clientSourcePage.trim();
  if (!/^\/[a-z0-9/_?=&.%~-]*$/i.test(path) || path.length > 300) return "/";
  return path.startsWith("/corretor/") ? "/" : path;
}

/**
 * Resolve a origem de um envio a partir do cabeçalho Host (definido pela plataforma) e do banco.
 * Nenhum identificador de site, corretor ou código Vista vem do navegador.
 *
 * - Host institucional ou externo (preview) → MAISON_SITE.
 * - Host de corretor → exige recurso ligado, formulários ligados, site PUBLICADO, usuário ativo com perfil BROKER.
 * - Host inválido ou reservado no domínio dos corretores → recusado.
 */
export async function resolveLeadOrigin(db: Db, rawHost: string | null, clientSourcePage: string, config: Pick<BrokerSitesConfig, "enabled" | "baseDomain" | "institutionalHosts">, brokerLeadsEnabled: boolean): Promise<LeadOrigin> {
  const hostname = normalizeHost(rawHost);
  const path = cleanPath(clientSourcePage);
  const resolution = resolveHost(rawHost, config);
  if (resolution.kind === "invalid" || resolution.kind === "reserved") throw new LeadOriginError(BROKER_SITE_UNAVAILABLE);
  if (resolution.kind === "institutional") return { source: "MAISON_SITE", hostname, path };
  if (!config.enabled) throw new LeadOriginError(BROKER_SITE_UNAVAILABLE);
  if (!brokerLeadsEnabled) throw new LeadOriginError(BROKER_LEADS_DISABLED);
  const row = (await db.select({
    siteId: brokerSites.id, subdomain: brokerSites.subdomain, status: brokerSites.status,
    userId: brokerProfiles.userId, vistaBrokerCode: brokerProfiles.vistaBrokerCode, vistaBrokerCodeVerifiedAt: brokerProfiles.vistaBrokerCodeVerifiedAt,
    active: adminUsers.active,
    isBroker: sql<boolean>`EXISTS (SELECT 1 FROM ${userRoles} INNER JOIN ${roles} ON ${roles.id} = ${userRoles.roleId} WHERE ${userRoles.userId} = ${brokerProfiles.userId} AND ${roles.code} = 'BROKER')`,
  }).from(brokerSites).innerJoin(brokerProfiles, eq(brokerProfiles.id, brokerSites.brokerProfileId)).innerJoin(adminUsers, eq(adminUsers.id, brokerProfiles.userId))
    .where(and(eq(brokerSites.subdomain, resolution.subdomain))).limit(1))[0];
  if (!row || !isPubliclyVisible(row.status) || !row.active || !row.isBroker) throw new LeadOriginError(BROKER_SITE_UNAVAILABLE);
  return {
    source: "BROKER_SITE", hostname: hostname!, path, brokerSiteId: row.siteId, brokerUserId: row.userId, subdomain: row.subdomain,
    // Somente código definido/verificado por ADMIN.
    vistaBrokerCode: row.vistaBrokerCode && row.vistaBrokerCodeVerifiedAt ? row.vistaBrokerCode : null,
  };
}

/**
 * Submissão de leads com origem resolvida no servidor. Para sites de corretor, o imóvel precisa estar
 * na seleção pública do site (validado pelo serviço de leads existente, que também persiste e entrega).
 */
export class BrokerLeadSubmissionService {
  constructor(private readonly db: Db, private readonly submission: LeadSubmissionService, private readonly config: Pick<BrokerSitesConfig, "enabled" | "baseDomain" | "institutionalHosts">, private readonly brokerLeadsEnabled: boolean) {}

  async submit(raw: Record<string, unknown>, sessionId: string, rawHost: string | null): Promise<LeadSubmissionResult> {
    const origin = await resolveLeadOrigin(this.db, rawHost, String(raw.sourcePage ?? ""), this.config, this.brokerLeadsEnabled);
    // `sourcePage` (enviado como "anuncio" ao Vista) é reescrito no servidor para sites de corretor.
    const sourcePage = origin.source === "BROKER_SITE" ? `/corretor/${origin.subdomain}${origin.path === "/" ? "" : origin.path}`.slice(0, 300) : origin.path;
    return this.submission.submit({ ...raw, sourcePage }, sessionId, origin);
  }
}
