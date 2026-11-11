import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrokerCatalog } from "@/components/broker-site/broker-catalog";
import { PUBLIC_LINKS } from "@/components/broker-site/links";
import { getBrokerSitesConfig } from "@/features/brokers/config";
import { loadBrokerCatalog } from "@/features/brokers/site-data";
import { resolveRequestSite } from "@/features/brokers/request-site";
import { brokerPageMetadata } from "@/features/brokers/site-seo";
import type { RawSearchParams } from "@/features/seo/indexing";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ subdomain: string }>; searchParams: Promise<RawSearchParams> };

/** Catálogo: subconjunto do catálogo Maison → noindex, follow; canonical na URL base do catálogo do corretor. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await resolveRequestSite((await params).subdomain);
  if (!site) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  return brokerPageMetadata({ site, config: getBrokerSitesConfig(), path: "/imoveis", title: "Imóveis", description: `Imóveis selecionados por ${site.displayName} entre a curadoria Vitória Maison.`, index: false });
}

export default async function BrokerCatalogPage({ params, searchParams }: Props) {
  const site = await resolveRequestSite((await params).subdomain);
  if (!site) notFound();
  // Filtros do usuário apenas restringem a seleção do site; o escopo (siteId) vem do hostname.
  const { data, facets, values } = await loadBrokerCatalog(site.siteId, await searchParams);
  return <BrokerCatalog name={site.displayName} data={data} facets={facets} links={PUBLIC_LINKS} values={values}/>;
}
