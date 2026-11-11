import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PropertyDetail } from "@/components/property/property-detail";
import { BrokerPropertyContact } from "@/components/broker-site/broker-property-contact";
import { getBrokerSitesConfig } from "@/features/brokers/config";
import { createBrokerServices } from "@/features/brokers/factory";
import { loadBrokerProperty } from "@/features/brokers/site-data";
import { brokerSiteUrl } from "@/features/brokers/hosts";
import { resolveRequestSite } from "@/features/brokers/request-site";
import { brokerPageMetadata } from "@/features/brokers/site-seo";
import { absoluteUrl, getSeoConfig } from "@/features/seo/config";
import { propertySeoDescription, propertySeoTitle } from "@/features/seo/property-seo";
import { cache } from "react";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ subdomain: string; slug: string }> };

/** O imóvel precisa pertencer a ESTE site e estar elegível na Maison; senão, 404 (inclusive imóvel de outro corretor). */
const loadProperty = cache(async (subdomain: string, slug: string) => {
  const site = await resolveRequestSite(subdomain);
  if (!site) return null;
  const property = await createBrokerServices().siteProperties.findBySlug(site.siteId, slug);
  return property ? { site, property } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain, slug } = await params;
  const data = await loadProperty(subdomain, slug);
  if (!data) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  // Conteúdo equivalente ao imóvel no site institucional: canonical aponta para a URL principal da Maison.
  const maisonUrl = absoluteUrl(getSeoConfig(), `/imoveis/${data.property.slug}`) ?? null;
  return brokerPageMetadata({ site: data.site, config: getBrokerSitesConfig(), path: `/imoveis/${slug}`, title: propertySeoTitle(data.property), description: propertySeoDescription(data.property), index: true, canonicalOverride: maisonUrl, images: data.property.editorial.images.slice(0, 3) });
}

export default async function BrokerPropertyPage({ params }: Props) {
  const { subdomain, slug } = await params;
  const data = await loadProperty(subdomain, slug);
  if (!data) notFound();
  const { site, property } = data;
  const related = (await loadBrokerProperty(site.siteId, property.slug))?.related ?? [];
  const home = brokerSiteUrl(site.subdomain, getBrokerSitesConfig());
  return <PropertyDetail property={property} backHref="/imoveis" backLabel="← Voltar à seleção" related={related} relatedTitle="Outros imóveis da minha seleção"
    aside={<BrokerPropertyContact site={site} property={property} propertyUrl={home ? new URL(`/imoveis/${property.slug}`, home).toString() : null}/>}/>;
}
