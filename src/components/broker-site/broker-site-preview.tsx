import { notFound } from "next/navigation";
import { BrokerFooter } from "./broker-footer";
import { BrokerHeader } from "./broker-header";
import { BrokerHome } from "./broker-home";
import { BrokerCatalog } from "./broker-catalog";
import { BrokerPropertyContact } from "./broker-property-contact";
import { previewLinks } from "./links";
import { PropertyDetail } from "@/components/property/property-detail";
import { getDatabase } from "@/database/client";
import { findSiteViewById, type BrokerSiteView } from "@/features/brokers/public-site-service";
import { loadBrokerCatalog, loadBrokerHome, loadBrokerProperty } from "@/features/brokers/site-data";
import { BROKER_SITE_STATUS_LABELS } from "@/features/brokers/status";
import type { RawSearchParams } from "@/features/seo/indexing";

/**
 * Prévia autenticada (painel) com o MESMO template do site público, em qualquer status.
 * Navegação entre home, catálogo e imóveis dentro da área protegida; formulários desativados
 * (nenhum lead de teste é gerado). A autorização (dono ou ADMIN) é feita pela página antes.
 */
async function Frame({ site, base, children }: { site: BrokerSiteView; base: string; children: React.ReactNode }) {
  return <div className="-m-5 bg-[#f8f6f2] text-[#181817] lg:-m-8">
    <p className="sticky top-0 z-40 bg-amber-300 px-5 py-3 text-sm font-semibold text-amber-950">Prévia — status: {BROKER_SITE_STATUS_LABELS[site.status]}. Visível só para você{site.status === "PUBLISHED" ? " neste endereço" : ""}; formulários desativados.</p>
    <BrokerHeader name={site.displayName} links={previewLinks(base)}/>
    {children}
    <BrokerFooter name={site.displayName}/>
  </div>;
}

async function loadSite(siteId: string): Promise<BrokerSiteView> {
  const site = await findSiteViewById(getDatabase(), siteId);
  if (!site) notFound();
  return site;
}

export async function BrokerPreviewHome({ siteId, base }: { siteId: string; base: string }) {
  const site = await loadSite(siteId);
  const { featured, total, facets } = await loadBrokerHome(siteId);
  return <Frame site={site} base={base}><BrokerHome site={site} featured={featured} total={total} facets={facets} links={previewLinks(base)} preview/></Frame>;
}

export async function BrokerPreviewCatalog({ siteId, base, searchParams }: { siteId: string; base: string; searchParams: RawSearchParams }) {
  const site = await loadSite(siteId);
  const { data, facets, values } = await loadBrokerCatalog(siteId, searchParams);
  return <Frame site={site} base={base}><BrokerCatalog name={site.displayName} data={data} facets={facets} values={values} links={previewLinks(base)}/></Frame>;
}

export async function BrokerPreviewProperty({ siteId, base, slug }: { siteId: string; base: string; slug: string }) {
  const site = await loadSite(siteId);
  const data = await loadBrokerProperty(siteId, slug);
  if (!data) notFound();
  const links = previewLinks(base);
  return <Frame site={site} base={base}><PropertyDetail property={data.property} backHref={links.catalog!} backLabel="← Voltar à seleção" related={data.related} relatedTitle="Outros imóveis da minha seleção" hrefFor={links.property}
    aside={<BrokerPropertyContact site={site} property={data.property} propertyUrl={null} preview/>}/></Frame>;
}

/** Compatibilidade: prévia da home. */
export async function BrokerSitePreview({ siteId, base }: { siteId: string; base: string }) { return <BrokerPreviewHome siteId={siteId} base={base}/>; }
