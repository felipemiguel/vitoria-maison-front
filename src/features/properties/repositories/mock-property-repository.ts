import { mockProperties } from "../mocks/properties";
import type { PaginatedProperties, Property, PropertyFacets, PropertyFilters, PropertyRepository, PropertySitemapRow } from "../types";

export class MockPropertyRepository implements PropertyRepository {
  async list(filters: PropertyFilters = {}): Promise<PaginatedProperties> {
    // Conteúdo mock nunca alimenta sites de corretores.
    if (filters.brokerSiteId) return { items: [], total: 0, page: filters.page ?? 1, pageSize: filters.pageSize ?? 9, pages: 1 };
    let items = mockProperties.filter((p) => p.curation.published);
    if (filters.slug) items = items.filter((p) => p.slug === filters.slug);
    if (filters.vistaCode) items = items.filter((p) => p.commercial.code.toLowerCase() === filters.vistaCode!.toLowerCase());
    if (filters.purpose) items = items.filter((p) => p.commercial.purpose === filters.purpose);
    if (filters.city) items = items.filter((p) => p.location.city.toLowerCase() === filters.city!.toLowerCase());
    if (filters.neighborhood) items = items.filter((p) => p.location.neighborhood.toLowerCase() === filters.neighborhood!.toLowerCase());
    if (filters.type) items = items.filter((p) => p.commercial.type === filters.type);
    if (filters.minPrice) items = items.filter((p) => p.commercial.price >= filters.minPrice!);
    if (filters.maxPrice) items = items.filter((p) => p.commercial.price <= filters.maxPrice!);
    if (filters.minArea) items = items.filter((p) => p.commercial.area >= filters.minArea!);
    if (filters.maxArea) items = items.filter((p) => p.commercial.area <= filters.maxArea!);
    if (filters.bedrooms) items = items.filter((p) => (p.commercial.bedrooms ?? 0) >= filters.bedrooms!);
    if (filters.collection) items = items.filter((p) => p.curation.collections.includes(filters.collection!));
    if (filters.featured !== undefined) items = items.filter((p) => p.curation.featured === filters.featured);
    if (filters.sort === "price-asc") items.sort((a, b) => a.commercial.price - b.commercial.price);
    if (filters.sort === "price-desc") items.sort((a, b) => b.commercial.price - a.commercial.price);
    if (filters.sort === "area-desc") items.sort((a, b) => b.commercial.area - a.commercial.area);
    if (filters.sort === "editorial") items.sort((a, b) => (a.curation.featuredOrder ?? 999) - (b.curation.featuredOrder ?? 999));
    const total = items.length, pageSize = filters.pageSize ?? 9, page = filters.page ?? 1;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  async findBySlug(slug: string): Promise<Property | null> { return mockProperties.find((p) => p.slug === slug && p.curation.published) ?? null; }
  async findFeatured(): Promise<Property[]> { return mockProperties.filter((p) => p.curation.published && p.curation.featured).sort((a,b) => (a.curation.featuredOrder ?? 99) - (b.curation.featuredOrder ?? 99)); }
  async findByCollection(collectionSlug: string): Promise<Property[]> { return mockProperties.filter((p) => p.curation.published && p.curation.collections.includes(collectionSlug)); }
  async findSlugByExternalCode(code: string): Promise<string | null> { return mockProperties.find((p) => p.commercial.code === code && p.curation.published)?.slug ?? null; }
  /** Conteúdo demonstrativo nunca entra no sitemap. */
  async listSitemapEntries(): Promise<PropertySitemapRow[]> { return []; }
  async countEligibleByCollection(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const property of mockProperties.filter((p) => p.curation.published)) for (const slug of property.curation.collections.filter(Boolean)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    return counts;
  }
  async listFacets(filters: PropertyFilters = {}): Promise<PropertyFacets> {
    const items = (await this.list({ ...filters, page: 1, pageSize: 1000 })).items;
    const unique = <T extends string>(values: T[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { purposes: unique(items.map((p) => p.commercial.purpose)), types: unique(items.map((p) => p.commercial.type)), neighborhoods: unique(items.map((p) => p.location.neighborhood)) };
  }
}
