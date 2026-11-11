import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { brokerProfiles, brokerSites, type BrokerSiteStatus } from "@/database/schema";
import { isPubliclyVisible } from "./status";
import { mediaPath } from "@/features/media/media-url";

type Db = NodePgDatabase<typeof schema>;

/**
 * Dados exibíveis de um site. Apenas campos públicos do perfil profissional:
 * sem ID de usuário, e-mail de login, telefone interno ou dados não verificados.
 * `siteId` é usado somente no servidor (consultas); não é renderizado.
 */
export type BrokerSiteView = {
  siteId: string;
  subdomain: string;
  status: BrokerSiteStatus;
  displayName: string;
  professionalTitle: string | null;
  headline: string | null;
  subtitle: string | null;
  biography?: string | null;
  profileImageUrl?: string | null;
  whatsapp?: string | null;
  emailPublic?: string | null;
  /** Somente quando verificado por um ADMIN. */
  creci?: string | null;
  /** Imagem de apresentação do site (hero). */
  presentationImageUrl?: string | null;
  introText?: string | null;
  serviceText?: string | null;
  specialties?: string[];
  serviceRegions?: string[];
};

async function loadView(db: Db, where: ReturnType<typeof eq>): Promise<BrokerSiteView | null> {
  const row = (await db.select({
    siteId: brokerSites.id, subdomain: brokerSites.subdomain, status: brokerSites.status, headline: brokerSites.headline, subtitle: brokerSites.subtitle, settings: brokerSites.settings, heroImageAssetId: brokerSites.heroImageAssetId, heroImageUrl: brokerSites.heroImageUrl,
    displayName: brokerProfiles.displayName, professionalTitle: brokerProfiles.professionalTitle, biography: brokerProfiles.biography,
    profileImageUrl: brokerProfiles.profileImageUrl, profileImageAssetId: brokerProfiles.profileImageAssetId, whatsapp: brokerProfiles.whatsapp, emailPublic: brokerProfiles.emailPublic,
    creci: brokerProfiles.creci, creciVerifiedAt: brokerProfiles.creciVerifiedAt, specialties: brokerProfiles.specialties, serviceRegions: brokerProfiles.serviceRegions,
  }).from(brokerSites).innerJoin(brokerProfiles, eq(brokerProfiles.id, brokerSites.brokerProfileId)).where(where).limit(1))[0];
  if (!row) return null;
  const { creci, creciVerifiedAt, profileImageAssetId, settings, heroImageAssetId, heroImageUrl, ...view } = row;
  const text = (key: string) => { const value = (settings as Record<string, unknown> | null)?.[key]; return typeof value === "string" && value.trim() ? value : null; };
  // Foto enviada pelo painel tem precedência sobre a URL antiga.
  return { ...view, presentationImageUrl: heroImageAssetId ? mediaPath(heroImageAssetId) : heroImageUrl, introText: text("introText"), serviceText: text("serviceText"), profileImageUrl: profileImageAssetId ? mediaPath(profileImageAssetId) : view.profileImageUrl, creci: creciVerifiedAt ? creci : null, specialties: Array.isArray(view.specialties) ? view.specialties : [], serviceRegions: Array.isArray(view.serviceRegions) ? view.serviceRegions : [] };
}

/** Leitura pública: retorna apenas sites PUBLICADOS. Rascunho, revisão, suspenso e inexistente → null (404). */
export async function findPublishedSiteBySubdomain(db: Db, subdomain: string): Promise<BrokerSiteView | null> {
  const view = await loadView(db, eq(brokerSites.subdomain, subdomain));
  return view && isPubliclyVisible(view.status) ? view : null;
}

/** Leitura para prévia autenticada: qualquer status. A autorização é feita antes pelo chamador. */
export async function findSiteViewById(db: Db, siteId: string): Promise<BrokerSiteView | null> {
  return loadView(db, eq(brokerSites.id, siteId));
}
