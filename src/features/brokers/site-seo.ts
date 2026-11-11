import type { Metadata } from "next";
import { absoluteUrl, getSeoConfig, isHttpsUrl, type SeoConfig } from "@/features/seo/config";
import { truncateText, robotsFor, defaultShareImage } from "@/features/seo/metadata";
import type { BrokerSitesConfig } from "./config";
import { brokerSiteUrl } from "./hosts";
import { isMediaPath } from "@/features/media/media-url";
import type { BrokerSiteView } from "./public-site-service";

type Env = Partial<Record<string, string | undefined>>;

/**
 * Indexação de sites de corretores: exige a indexação global da Maison liberada (getSeoConfig),
 * a decisão explícita BROKER_SITES_INDEXING_ENABLED=true e o site PUBLICADO.
 * Rascunho, revisão, suspenso, prévias e diagnóstico nunca são indexados.
 */
export function brokerSiteIndexable(site: Pick<BrokerSiteView, "status">, seo: Pick<SeoConfig, "indexingEnabled"> = getSeoConfig(), env: Env = process.env): boolean {
  return seo.indexingEnabled && env.BROKER_SITES_INDEXING_ENABLED?.trim() === "true" && site.status === "PUBLISHED";
}

/** Descrição só com dados reais do corretor; nada de experiência ou bairros inventados. */
export function brokerSiteDescription(site: BrokerSiteView): string {
  const base = site.subtitle?.trim() || site.headline?.trim() || site.biography?.trim();
  if (base) return truncateText(base);
  const regions = site.serviceRegions?.length ? ` Atuação: ${site.serviceRegions.slice(0, 3).join(", ")}.` : "";
  return truncateText(`Imóveis selecionados por ${site.displayName}, corretor(a) parceiro(a) da Vitória Maison.${regions}`);
}

export function brokerSiteTitle(site: BrokerSiteView): string {
  return `${site.displayName}${site.professionalTitle ? ` — ${site.professionalTitle}` : ""} | Vitória Maison`;
}

type PageInput = { site: BrokerSiteView; config: BrokerSitesConfig; path: string; title?: string; description?: string; index: boolean; canonicalOverride?: string | null; images?: { url: string; alt: string }[] };

/** Metadata de uma página do site: canonical no hostname do corretor (ou override), sem dados de outro site. */
export function brokerPageMetadata({ site, config, path, title, description, index, canonicalOverride, images }: PageInput, seo: SeoConfig = getSeoConfig()): Metadata {
  const home = brokerSiteUrl(site.subdomain, config);
  const canonical = canonicalOverride === undefined ? (home ? new URL(path, home).toString() : undefined) : canonicalOverride ?? undefined;
  const fullTitle = title ? `${title} | ${site.displayName} · Vitória Maison` : brokerSiteTitle(site);
  const desc = truncateText(description ?? brokerSiteDescription(site));
  const photoUrl = publicPhotoUrl(site.profileImageUrl, seo);
  const photo = photoUrl ? [{ url: photoUrl, alt: site.displayName }] : [];
  const share = images?.length ? images : photo.length ? photo : [{ ...defaultShareImage(), url: absoluteUrl(seo, defaultShareImage().url) ?? defaultShareImage().url }];
  return {
    title: { absolute: fullTitle },
    description: desc,
    alternates: canonical ? { canonical } : undefined,
    robots: robotsFor(index && brokerSiteIndexable(site, seo), { indexingEnabled: brokerSiteIndexable(site, seo) }),
    openGraph: { type: "website", locale: "pt_BR", siteName: `${site.displayName} · Vitória Maison`, title: fullTitle, description: desc, ...(canonical ? { url: canonical } : {}), images: share },
    twitter: { card: "summary_large_image", title: fullTitle, description: desc, images: share.map((image) => ({ url: image.url, alt: image.alt })) },
  };
}

/** JSON-LD do corretor: somente dados reais e públicos do perfil; vinculado à Vitória Maison. */
export function brokerAgentJsonLd(site: BrokerSiteView, canonical: string | null, seo: SeoConfig = getSeoConfig()): Record<string, unknown> | null {
  if (!canonical) return null;
  const phone = site.whatsapp?.replace(/\D/g, "");
  const data: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "RealEstateAgent", "@id": `${canonical}#corretor`, name: site.displayName, url: canonical,
    description: brokerSiteDescription(site),
    image: publicPhotoUrl(site.profileImageUrl, seo) ?? undefined,
    email: site.emailPublic ?? undefined,
    telephone: phone && phone.length >= 10 ? `+${phone.length <= 11 ? `55${phone}` : phone}` : undefined,
    areaServed: site.serviceRegions?.length ? site.serviceRegions.map((name) => ({ "@type": "Place", name })) : undefined,
    knowsAbout: site.specialties?.length ? site.specialties : undefined,
    identifier: site.creci ? { "@type": "PropertyValue", propertyID: "CRECI", value: site.creci } : undefined,
    parentOrganization: { "@type": "RealEstateAgent", name: "Vitória Maison", ...(absoluteUrl(seo, "/") ? { url: absoluteUrl(seo, "/") } : {}) },
  };
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

/** URL absoluta da foto (mídia do banco é servida pelo domínio institucional). */
function publicPhotoUrl(value: string | null | undefined, seo: SeoConfig): string | null {
  if (isMediaPath(value)) return absoluteUrl(seo, value) ?? null;
  return isHttpsUrl(value) ? value : null;
}

