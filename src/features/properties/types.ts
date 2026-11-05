export type PropertyPurpose = "SALE" | "RENT" | "INVESTMENT";
export type PropertyType = "APARTMENT" | "FLAT" | "STUDIO" | "PENTHOUSE";
export type Property = {
  id: string; externalId?: string; slug: string;
  commercial: { purpose: PropertyPurpose; type: PropertyType; price: number; area: number; bedrooms?: number; suites?: number; bathrooms?: number; parkingSpaces?: number; code: string };
  location: { neighborhood: string; city: string; state: string };
  editorial: { title: string; description: string; images: { url: string; alt: string }[]; features: string[] };
  curation: { published: boolean; featured: boolean; featuredOrder?: number; collections: string[] };
};
export type PropertyFilters = { purpose?: PropertyPurpose; neighborhood?: string; type?: PropertyType; minPrice?: number; maxPrice?: number; minArea?: number; bedrooms?: number; sort?: "price-asc" | "price-desc" | "area-desc"; page?: number; pageSize?: number };
export type PaginatedProperties = { items: Property[]; total: number; page: number; pageSize: number; pages: number };
export interface PropertyRepository { list(filters?: PropertyFilters): Promise<PaginatedProperties>; findBySlug(slug: string): Promise<Property | null>; findFeatured(): Promise<Property[]>; }
