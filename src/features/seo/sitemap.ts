import type { MetadataRoute } from "next";
import { absoluteUrl, type SeoConfig } from "./config";
import { isCollectionIndexable } from "./indexing";

/**
 * Páginas estáticas indexáveis. Ficam de fora: /perspectivas (conteúdo demonstrativo),
 * /termos (texto provisório), admin, login, preview, API e qualquer URL com filtros.
 */
export const INDEXABLE_STATIC_PATHS = ["/", "/imoveis", "/comprar", "/alugar", "/investir", "/sobre", "/contato", "/anuncie-seu-imovel", "/privacidade"] as const;

/** Limite do protocolo por arquivo. Acima disso, dividir com `generateSitemaps`. */
export const SITEMAP_URL_LIMIT = 50_000;

export type PropertySitemapEntry = { slug: string; lastModified?: Date };
export type CollectionSitemapEntry = { slug: string; eligibleItems: number; lastModified?: Date };

export function buildSitemap(config: SeoConfig, properties: PropertySitemapEntry[], collections: CollectionSitemapEntry[]): MetadataRoute.Sitemap {
  if (!config.indexingEnabled || !config.siteUrl) return [];
  const url = (path: string) => absoluteUrl(config, path)!;
  const indexableCollections = collections.filter((collection) => isCollectionIndexable(collection.eligibleItems));
  const entries: MetadataRoute.Sitemap = [
    ...INDEXABLE_STATIC_PATHS.map((path) => ({ url: url(path) })),
    ...(indexableCollections.length ? [{ url: url("/colecoes") }] : []),
    ...indexableCollections.map((collection) => withLastModified({ url: url(`/colecoes/${collection.slug}`) }, collection.lastModified)),
    ...properties.map((property) => withLastModified({ url: url(`/imoveis/${property.slug}`) }, property.lastModified)),
  ];
  if (entries.length > SITEMAP_URL_LIMIT) throw new Error(`Sitemap excede ${SITEMAP_URL_LIMIT} URLs; dividir com generateSitemaps.`);
  return entries;
}

function withLastModified(entry: { url: string }, date: Date | undefined): MetadataRoute.Sitemap[number] {
  return date && !Number.isNaN(date.getTime()) ? { ...entry, lastModified: date } : entry;
}
