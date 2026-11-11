export type PropertyPurpose = "SALE" | "RENT" | "INVESTMENT";
export type PropertyType = "APARTMENT" | "FLAT" | "STUDIO" | "PENTHOUSE";
export type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";

export type PropertyCommercialData = {
  externalCode: string;
  rawCategory?: string;
  sourceTitle?: string;
  sourceDescription?: string;
  category?: PropertyType;
  city: string;
  neighborhood: string;
  salePrice?: number;
  rentalPrice?: number;
  privateArea?: number;
  totalArea?: number;
  bedrooms?: number;
  suites?: number;
  parkingSpaces?: number;
  coverImageUrl?: string;
  images: { url: string; alt: string }[];
  characteristics: unknown;
  infrastructure: unknown;
  availabilityStatus: AvailabilityStatus;
  sourcePurpose?: string;
  sourceUpdatedAt?: Date;
  fetchedAt: Date;
};

export type PropertyEditorialData = { title?: string; description?: string; coverUrl?: string };
export type PropertyCuration = { published: boolean; featured: boolean; featuredOrder?: number; publicationPurpose?: PropertyPurpose; collections: string[] };

export type PublishedProperty = {
  id: string; externalId?: string; slug: string;
  commercial: { purpose: PropertyPurpose; type: PropertyType; price: number; area: number; bedrooms?: number; suites?: number; bathrooms?: number; parkingSpaces?: number; code: string };
  location: { neighborhood: string; city: string; state: string };
  editorial: { title: string; description: string; descriptionSource?: "editorial" | "source" | "generated"; images: { url: string; alt: string }[]; features: string[] };
  curation: { published: boolean; featured: boolean; featuredOrder?: number; collections: string[] };
};
export type Property = PublishedProperty;
export type PropertyFilters = { /** Slug exato (detalhe dentro de um escopo, ex.: site de corretor). */ slug?: string; /** Código Vista exato (sem diferenciar maiúsculas). */ vistaCode?: string; purpose?: PropertyPurpose; city?: string; neighborhood?: string; type?: PropertyType; category?: string; minPrice?: number; maxPrice?: number; minArea?: number; maxArea?: number; bedrooms?: number; collection?: string; /** Restringe aos imóveis selecionados por um site de corretor (já publicado). */ brokerSiteId?: string; featured?: boolean; sort?: "price-asc" | "price-desc" | "area-desc" | "editorial" | /** destaque e ordem definidos pelo site do corretor */ "site"; page?: number; pageSize?: number };
/** Valores existentes entre os imóveis elegíveis de um escopo; usados para montar filtros reais. */
export type PropertyFacets = { purposes: PropertyPurpose[]; types: PropertyType[]; neighborhoods: string[] };
export type PaginatedProperties = { items: Property[]; total: number; page: number; pageSize: number; pages: number };
export type PropertySitemapRow = { slug: string; lastModified?: Date };
export interface PropertyRepository {
  list(filters?: PropertyFilters): Promise<PaginatedProperties>;
  findBySlug(slug: string): Promise<Property | null>;
  findFeatured(): Promise<Property[]>;
  findByCollection(collectionSlug: string): Promise<Property[]>;
  /** Slug público de um imóvel elegível a partir do código Vista (redirecionamentos do legado). */
  findSlugByExternalCode(code: string): Promise<string | null>;
  /** Imóveis elegíveis para o sitemap. Fontes mock retornam lista vazia: conteúdo fictício nunca é indexado. */
  listSitemapEntries(): Promise<PropertySitemapRow[]>;
  /** Quantidade de imóveis elegíveis por slug de coleção publicada. */
  countEligibleByCollection(): Promise<Map<string, number>>;
  /** Finalidades, tipos e bairros presentes entre os imóveis elegíveis que atendem aos filtros. */
  listFacets(filters?: PropertyFilters): Promise<PropertyFacets>;
}
