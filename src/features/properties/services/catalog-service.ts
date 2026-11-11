import { cache } from "react";
import type { Metadata } from "next";
import type { PropertyPurpose } from "../types";
import { propertyRepository } from "./property-service";
import { parseCatalogParams } from "@/features/seo/catalog-params";
import { listingIndexability, type RawSearchParams } from "@/features/seo/indexing";
import { buildPageMetadata } from "@/features/seo/metadata";

export const CATALOG_PAGE_SIZE = 9;

export type CatalogRoute = { basePath: "/imoveis" | "/comprar" | "/alugar"; fixedPurpose?: PropertyPurpose; title: string; description: string };

export const CATALOG_ROUTES = {
  all: { basePath: "/imoveis", title: "Imóveis selecionados em São Paulo", description: "Conheça apartamentos, flats, studios e coberturas selecionados pela curadoria Vitória Maison em São Paulo." },
  sale: { basePath: "/comprar", fixedPurpose: "SALE", title: "Imóveis à venda em São Paulo", description: "Apartamentos, flats, studios e coberturas à venda em São Paulo, selecionados pela curadoria Vitória Maison." },
  rent: { basePath: "/alugar", fixedPurpose: "RENT", title: "Imóveis para alugar em São Paulo", description: "Apartamentos, flats e studios para alugar em São Paulo, selecionados pela curadoria Vitória Maison." },
} satisfies Record<string, CatalogRoute>;

/** Consulta deduplicada por requisição entre generateMetadata e a página (argumentos primitivos). */
const listCached = cache((fixedPurpose: PropertyPurpose | "", serializedParams: string) => {
  const filters = parseCatalogParams(JSON.parse(serializedParams) as RawSearchParams, fixedPurpose || undefined);
  return propertyRepository.list({ ...filters, pageSize: CATALOG_PAGE_SIZE });
});

export function listCatalog(route: CatalogRoute, params: RawSearchParams) {
  return listCached(route.fixedPurpose ?? "", JSON.stringify(params));
}

export async function catalogMetadata(route: CatalogRoute, params: RawSearchParams): Promise<Metadata> {
  const data = await listCatalog(route, params);
  const policy = listingIndexability(route.basePath, params, data.items.length, data.pages);
  const pageSuffix = policy.reason === "PAGINATED" ? ` — página ${data.page}` : "";
  return buildPageMetadata({ title: `${route.title}${pageSuffix}`, description: route.description, path: policy.canonicalPath, index: policy.indexable });
}
