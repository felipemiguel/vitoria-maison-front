import type { MetadataRoute } from "next";
import { propertyRepository } from "@/features/properties/services/property-service";
import { listPublicCollections } from "@/features/collections/public-collection-service";
import { getSeoConfig } from "@/features/seo/config";
import { buildSitemap } from "@/features/seo/sitemap";

/** Dinâmico: a elegibilidade depende do horário (expiração da confirmação e idade do snapshot). */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = getSeoConfig();
  if (!config.indexingEnabled) return [];
  const [properties, collections, counts] = await Promise.all([
    propertyRepository.listSitemapEntries(),
    listPublicCollections(),
    propertyRepository.countEligibleByCollection(),
  ]);
  return buildSitemap(config, properties, collections.map((collection) => ({ slug: collection.slug, eligibleItems: counts.get(collection.slug) ?? 0, lastModified: collection.updatedAt })));
}
