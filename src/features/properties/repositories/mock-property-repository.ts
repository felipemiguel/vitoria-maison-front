import { mockProperties } from "../mocks/properties";
import type { PaginatedProperties, Property, PropertyFilters, PropertyRepository } from "../types";

export class MockPropertyRepository implements PropertyRepository {
  async list(filters: PropertyFilters = {}): Promise<PaginatedProperties> {
    let items = mockProperties.filter((p) => p.curation.published);
    if (filters.purpose) items = items.filter((p) => p.commercial.purpose === filters.purpose);
    if (filters.neighborhood) items = items.filter((p) => p.location.neighborhood.toLowerCase() === filters.neighborhood!.toLowerCase());
    if (filters.type) items = items.filter((p) => p.commercial.type === filters.type);
    if (filters.minPrice) items = items.filter((p) => p.commercial.price >= filters.minPrice!);
    if (filters.maxPrice) items = items.filter((p) => p.commercial.price <= filters.maxPrice!);
    if (filters.minArea) items = items.filter((p) => p.commercial.area >= filters.minArea!);
    if (filters.bedrooms) items = items.filter((p) => (p.commercial.bedrooms ?? 0) >= filters.bedrooms!);
    if (filters.sort === "price-asc") items.sort((a, b) => a.commercial.price - b.commercial.price);
    if (filters.sort === "price-desc") items.sort((a, b) => b.commercial.price - a.commercial.price);
    if (filters.sort === "area-desc") items.sort((a, b) => b.commercial.area - a.commercial.area);
    const total = items.length, pageSize = filters.pageSize ?? 9, page = filters.page ?? 1;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  async findBySlug(slug: string): Promise<Property | null> { return mockProperties.find((p) => p.slug === slug && p.curation.published) ?? null; }
  async findFeatured(): Promise<Property[]> { return mockProperties.filter((p) => p.curation.published && p.curation.featured).sort((a,b) => (a.curation.featuredOrder ?? 99) - (b.curation.featuredOrder ?? 99)); }
}
