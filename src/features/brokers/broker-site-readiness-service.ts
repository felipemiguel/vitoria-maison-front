import { and, count, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { brokerProfiles, brokerSiteProperties, brokerSites, curatedProperties, propertySnapshots } from "@/database/schema";
import type { PublicationPolicyConfig } from "@/features/properties/config";
import { publicVisibilityConditions } from "@/features/properties/publication/property-publication-policy";
import { validateSubdomain } from "./subdomain-rules";

type Db = NodePgDatabase<typeof schema>;
type Env = Partial<Record<string, string | undefined>>;

export type BrokerSiteReadinessItem = { key: string; label: string; done: boolean };
export type BrokerSiteReadiness = { ready: boolean; completed: number; total: number; missing: string[]; items: BrokerSiteReadinessItem[] };

export const BIOGRAPHY_MIN_LENGTH = 40;

/** Política administrativa: por padrão o CRECI precisa estar verificado pela equipe. */
export function requiresVerifiedCreci(env: Env = process.env): boolean {
  return env.BROKER_SITES_REQUIRE_VERIFIED_CRECI?.trim() !== "false";
}

export type ReadinessInput = {
  displayName: string | null;
  creci: string | null;
  creciVerified: boolean;
  hasPhoto: boolean;
  biography: string | null;
  whatsapp: string | null;
  phone: string | null;
  emailPublic: string | null;
  subdomain: string;
  headline: string | null;
  eligibleProperties: number;
};

/** Avaliação pura (testável). Todos os critérios são obrigatórios; o percentual reflete critérios reais. */
export function evaluateReadiness(input: ReadinessInput, requireVerifiedCreci = requiresVerifiedCreci()): BrokerSiteReadiness {
  const items: BrokerSiteReadinessItem[] = [
    { key: "displayName", label: "Nome profissional", done: Boolean(input.displayName?.trim()) },
    { key: "creci", label: requireVerifiedCreci ? "CRECI verificado pela equipe" : "CRECI informado", done: requireVerifiedCreci ? Boolean(input.creci && input.creciVerified) : Boolean(input.creci) },
    { key: "photo", label: "Foto profissional", done: input.hasPhoto },
    { key: "biography", label: `Biografia (mínimo de ${BIOGRAPHY_MIN_LENGTH} caracteres)`, done: (input.biography?.trim().length ?? 0) >= BIOGRAPHY_MIN_LENGTH },
    { key: "contact", label: "WhatsApp, telefone ou e-mail público", done: Boolean(input.whatsapp || input.phone || input.emailPublic) },
    { key: "subdomain", label: "Endereço do site válido", done: validateSubdomain(input.subdomain).ok },
    { key: "headline", label: "Título principal da página", done: Boolean(input.headline?.trim()) },
    { key: "properties", label: "Pelo menos um imóvel selecionado e disponível na Maison", done: input.eligibleProperties > 0 },
  ];
  const completed = items.filter((item) => item.done).length;
  return { ready: completed === items.length, completed, total: items.length, missing: items.filter((item) => !item.done).map((item) => item.label), items };
}

/**
 * Completude do site a partir dos dados reais (perfil, site e imóveis elegíveis na Maison).
 * Usada no painel, no envio para revisão e na aprovação administrativa.
 */
export class BrokerSiteReadinessService {
  constructor(private readonly db: Db, private readonly policy: PublicationPolicyConfig, private readonly now: () => Date = () => new Date()) {}

  async evaluate(siteId: string): Promise<BrokerSiteReadiness | null> {
    const row = (await this.db.select({ site: brokerSites, profile: brokerProfiles }).from(brokerSites)
      .innerJoin(brokerProfiles, eq(brokerProfiles.id, brokerSites.brokerProfileId)).where(eq(brokerSites.id, siteId)).limit(1))[0];
    if (!row) return null;
    const eligible = await this.db.select({ total: count() }).from(brokerSiteProperties)
      .innerJoin(curatedProperties, eq(curatedProperties.id, brokerSiteProperties.curatedPropertyId))
      .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(and(eq(brokerSiteProperties.brokerSiteId, siteId), ...publicVisibilityConditions(this.now(), this.policy)));
    return evaluateReadiness({
      displayName: row.profile.displayName, creci: row.profile.creci, creciVerified: Boolean(row.profile.creciVerifiedAt),
      hasPhoto: Boolean(row.profile.profileImageAssetId || row.profile.profileImageUrl), biography: row.profile.biography,
      whatsapp: row.profile.whatsapp, phone: row.profile.phone, emailPublic: row.profile.emailPublic,
      subdomain: row.site.subdomain, headline: row.site.headline, eligibleProperties: Number(eligible[0]?.total ?? 0),
    });
  }
}
