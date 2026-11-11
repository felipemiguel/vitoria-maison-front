import { createBrokerServices } from "./factory";
import { parseCatalogParams } from "@/features/seo/catalog-params";
import type { RawSearchParams } from "@/features/seo/indexing";
import type { Property } from "@/features/properties/types";

/** Dados compartilhados entre o site público e a prévia autenticada (mesmo template, mesmas regras). */
export const BROKER_CATALOG_PAGE_SIZE = 9;

export async function loadBrokerHome(siteId: string) {
  const { siteProperties } = createBrokerServices();
  const [featured, total, facets] = await Promise.all([siteProperties.featured(siteId, 6), siteProperties.countVisible(siteId), siteProperties.facets(siteId)]);
  return { featured, total, facets };
}

export async function loadBrokerCatalog(siteId: string, raw: RawSearchParams) {
  const filters = parseCatalogParams(raw);
  const { siteProperties } = createBrokerServices();
  const [data, facets] = await Promise.all([
    siteProperties.list(siteId, { purpose: filters.purpose, type: filters.type, neighborhood: filters.neighborhood, sort: filters.sort ?? "site", page: filters.page, pageSize: BROKER_CATALOG_PAGE_SIZE }),
    siteProperties.facets(siteId),
  ]);
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return { data, facets, values: { finalidade: filters.purpose, bairro: filters.neighborhood, tipo: filters.type, ordem: filters.sort ? first(raw.ordem) : undefined } };
}

/** Imóvel do site + relacionados do mesmo site. null se não pertencer ao site ou estiver inelegível. */
export async function loadBrokerProperty(siteId: string, slug: string): Promise<{ property: Property; related: Property[] } | null> {
  const { siteProperties } = createBrokerServices();
  const property = await siteProperties.findBySlug(siteId, slug);
  if (!property) return null;
  const sameNeighborhood = (await siteProperties.list(siteId, { neighborhood: property.location.neighborhood, pageSize: 4 })).items;
  const pool = sameNeighborhood.length > 1 ? sameNeighborhood : (await siteProperties.list(siteId, { pageSize: 4 })).items;
  return { property, related: pool.filter((item) => item.id !== property.id).slice(0, 3) };
}
