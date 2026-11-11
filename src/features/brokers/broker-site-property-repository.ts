import type { PaginatedProperties, Property, PropertyFacets, PropertyFilters, PropertyRepository } from "@/features/properties/types";

/**
 * Imóveis de um site de corretor. Isolamento: o ID do site vem sempre da resolução do hostname no
 * servidor e é aplicado NO BANCO, junto com o mesmo predicado público do catálogo Maison
 * (publicado, elegível, disponibilidade confirmada, snapshot recente). Filtros do usuário só
 * restringem esse conjunto; nunca o ampliam para outros imóveis da Maison.
 * Chamar somente para sites PUBLICADOS (ou prévia autenticada).
 */
export class BrokerSitePropertyRepository {
  constructor(private readonly properties: PropertyRepository) {}

  list(brokerSiteId: string, filters: Omit<PropertyFilters, "brokerSiteId" | "collection" | "featured"> = {}): Promise<PaginatedProperties> {
    return this.properties.list({ ...filters, sort: filters.sort ?? "site", brokerSiteId });
  }

  /** Seleção da home: destaques do corretor primeiro, depois a ordem definida por ele. */
  async featured(brokerSiteId: string, limit = 6): Promise<Property[]> {
    return (await this.list(brokerSiteId, { sort: "site", pageSize: limit })).items;
  }

  /** Detalhe: o imóvel precisa pertencer a ESTE site e estar elegível; caso contrário, null (404). */
  async findBySlug(brokerSiteId: string, slug: string): Promise<Property | null> {
    if (!/^[a-z0-9-]{1,160}$/.test(slug)) return null;
    return (await this.list(brokerSiteId, { slug, pageSize: 1 })).items[0] ?? null;
  }

  facets(brokerSiteId: string): Promise<PropertyFacets> {
    return this.properties.listFacets({ brokerSiteId });
  }

  async countVisible(brokerSiteId: string): Promise<number> {
    return (await this.list(brokerSiteId, { pageSize: 1 })).total;
  }

  /** Compatibilidade com a Fase 6.4A. */
  listVisible(brokerSiteId: string, page = 1, pageSize = 12): Promise<PaginatedProperties> {
    return this.list(brokerSiteId, { page, pageSize });
  }
}
