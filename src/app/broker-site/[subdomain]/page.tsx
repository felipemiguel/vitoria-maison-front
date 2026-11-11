import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrokerHome } from "@/components/broker-site/broker-home";
import { PUBLIC_LINKS } from "@/components/broker-site/links";
import { JsonLd } from "@/components/seo/json-ld";
import { getBrokerSitesConfig } from "@/features/brokers/config";
import { loadBrokerHome } from "@/features/brokers/site-data";
import { brokerSiteUrl } from "@/features/brokers/hosts";
import { resolveRequestSite } from "@/features/brokers/request-site";
import { brokerAgentJsonLd, brokerPageMetadata } from "@/features/brokers/site-seo";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ subdomain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await resolveRequestSite((await params).subdomain);
  if (!site) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  return brokerPageMetadata({ site, config: getBrokerSitesConfig(), path: "/", index: true });
}

export default async function BrokerSiteHome({ params }: Props) {
  const site = await resolveRequestSite((await params).subdomain);
  if (!site) notFound();
  const { featured, total, facets } = await loadBrokerHome(site.siteId);
  return <><JsonLd data={brokerAgentJsonLd(site, brokerSiteUrl(site.subdomain, getBrokerSitesConfig()))}/><BrokerHome site={site} featured={featured} total={total} facets={facets} links={PUBLIC_LINKS}/></>;
}
