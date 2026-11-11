import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PaginatedProperties, Property, PropertyFilters, PropertyRepository, PropertySitemapRow } from "../types";
import type { PropertyType } from "../types";
import { collectionProperties, collections, curatedProperties, propertySnapshots } from "@/database/schema";
import * as schema from "@/database/schema";
import type { PublicationPolicyConfig } from "../config";
import { publicVisibilityConditions } from "../publication/property-publication-policy";

type Row = { curated: typeof curatedProperties.$inferSelect; snapshot: typeof propertySnapshots.$inferSelect };

export class DatabasePropertyRepository implements PropertyRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>, private readonly options: PublicationPolicyConfig, private readonly now: () => Date = () => new Date()) {}

  async list(filters: PropertyFilters = {}): Promise<PaginatedProperties> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 9));
    if (!this.options.defaultState) return { items: [], total: 0, page, pageSize, pages: 1 };

    const conditions = this.buildConditions(filters);
    const price = sql<string>`CASE
      WHEN ${curatedProperties.publicationPurpose} = 'RENT' THEN ${propertySnapshots.rentalPrice}
      ELSE ${propertySnapshots.salePrice}
    END`;
    const order = filters.sort === "price-asc" ? asc(price)
      : filters.sort === "price-desc" ? desc(price)
      : filters.sort === "area-desc" ? desc(propertySnapshots.privateArea)
      : asc(curatedProperties.featuredOrder);

    const [rows, totals] = await Promise.all([
      this.db.select({ curated: curatedProperties, snapshot: propertySnapshots })
        .from(curatedProperties)
        .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
        .where(and(...conditions)).orderBy(order, desc(curatedProperties.updatedAt))
        .limit(pageSize).offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(curatedProperties)
        .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
        .where(and(...conditions)),
    ]);
    const collectionMap = await this.loadCollections(rows.map((row) => row.curated.id));
    const items = rows.map((row) => this.toProperty(row, collectionMap.get(row.curated.id) ?? []));
    const total = Number(totals[0]?.total ?? 0);
    return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findBySlug(slug: string): Promise<Property | null> {
    if (!this.options.defaultState) return null;
    const rows = await this.db.select({ curated: curatedProperties, snapshot: propertySnapshots })
      .from(curatedProperties)
      .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(and(...this.buildConditions({}), eq(curatedProperties.slug, slug))).limit(1);
    const row = rows[0];
    if (!row) return null;
    const collectionMap = await this.loadCollections([row.curated.id]);
    return this.toProperty(row, collectionMap.get(row.curated.id) ?? []);
  }

  async findFeatured(): Promise<Property[]> {
    return (await this.list({ featured: true, sort: "editorial", pageSize: 50 })).items;
  }

  async findByCollection(collectionSlug: string): Promise<Property[]> {
    return (await this.list({ collection: collectionSlug, sort: "editorial", pageSize: 50 })).items;
  }

  async findSlugByExternalCode(code: string): Promise<string | null> {
    if (!this.options.defaultState || !/^[A-Za-z0-9-]{1,80}$/.test(code)) return null;
    const rows = await this.db.select({ slug: curatedProperties.slug }).from(curatedProperties)
      .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(and(...this.buildConditions({}), eq(curatedProperties.vistaCode, code))).limit(1);
    return rows[0]?.slug ?? null;
  }

  /**
   * Consulta enxuta para o sitemap: somente slug e data de atualização informada pelo Vista.
   * `curated_properties.updated_at` não é usado porque cada sincronização o altera.
   */
  async listSitemapEntries(): Promise<PropertySitemapRow[]> {
    if (!this.options.defaultState) return [];
    const rows = await this.db.select({ slug: curatedProperties.slug, sourceUpdatedAt: propertySnapshots.sourceUpdatedAt })
      .from(curatedProperties)
      .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(and(...this.buildConditions({}))).orderBy(asc(curatedProperties.slug));
    return rows.map((row) => ({ slug: row.slug, lastModified: row.sourceUpdatedAt ?? undefined }));
  }

  async countEligibleByCollection(): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!this.options.defaultState) return result;
    const rows = await this.db.select({ slug: collections.slug, total: count() })
      .from(collectionProperties)
      .innerJoin(collections, eq(collections.id, collectionProperties.collectionId))
      .innerJoin(curatedProperties, eq(curatedProperties.id, collectionProperties.curatedPropertyId))
      .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(and(eq(collections.published, true), ...this.buildConditions({})))
      .groupBy(collections.slug);
    for (const row of rows) result.set(row.slug, Number(row.total));
    return result;
  }

  private buildConditions(filters: PropertyFilters): SQL[] {
    const conditions: SQL[] = publicVisibilityConditions(this.now(), this.options);
    if (filters.purpose) conditions.push(eq(curatedProperties.publicationPurpose, filters.purpose));
    if (filters.city) conditions.push(ilike(propertySnapshots.city, filters.city));
    if (filters.neighborhood) conditions.push(ilike(propertySnapshots.neighborhood, filters.neighborhood));
    if (filters.category) conditions.push(ilike(propertySnapshots.rawCategory, filters.category));
    if (filters.type) conditions.push(eq(propertySnapshots.category, filters.type));
    if (filters.bedrooms) conditions.push(gte(propertySnapshots.bedrooms, filters.bedrooms));
    if (filters.minArea) conditions.push(gte(propertySnapshots.privateArea, String(filters.minArea)));
    if (filters.maxArea) conditions.push(lte(propertySnapshots.privateArea, String(filters.maxArea)));
    const price = sql`CASE WHEN ${curatedProperties.publicationPurpose} = 'RENT' THEN ${propertySnapshots.rentalPrice} ELSE ${propertySnapshots.salePrice} END`;
    if (filters.minPrice) conditions.push(sql`${price} >= ${filters.minPrice}`);
    if (filters.maxPrice) conditions.push(sql`${price} <= ${filters.maxPrice}`);
    if (filters.featured !== undefined) conditions.push(eq(curatedProperties.featured, filters.featured));
    if (filters.collection) conditions.push(inArray(curatedProperties.id,
      this.db.select({ id: collectionProperties.curatedPropertyId }).from(collectionProperties)
        .innerJoin(collections, eq(collections.id, collectionProperties.collectionId))
        .where(and(eq(collections.slug, filters.collection), eq(collections.published, true)))));
    return conditions;
  }

  private async loadCollections(ids: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (ids.length === 0) return result;
    const rows = await this.db.select({ propertyId: collectionProperties.curatedPropertyId, slug: collections.slug })
      .from(collectionProperties).innerJoin(collections, eq(collections.id, collectionProperties.collectionId))
      .where(and(inArray(collectionProperties.curatedPropertyId, ids), eq(collections.published, true)))
      .orderBy(asc(collectionProperties.sortOrder));
    for (const row of rows) result.set(row.propertyId, [...(result.get(row.propertyId) ?? []), row.slug]);
    return result;
  }

  private toProperty({ curated, snapshot }: Row, collectionSlugs: string[]): Property {
    const purpose = curated.publicationPurpose!;
    const type = snapshot.category as PropertyType;
    const priceValue = purpose === "RENT" ? snapshot.rentalPrice : snapshot.salePrice;
    const cover = curated.editorialCoverUrl ?? snapshot.coverImageUrl!;
    const title = curated.editorialTitle ?? snapshot.sourceTitle!;
    const images = normalizedImages(curated.editorialCoverUrl, snapshot.images, cover, title);
    const descriptionSource: Property["editorial"]["descriptionSource"] = curated.editorialDescription?.trim() ? "editorial" : snapshot.sourceDescription?.trim() ? "source" : "generated";
    const description = curated.editorialDescription?.trim() || snapshot.sourceDescription?.trim()
      || neutralDescription(snapshot.rawCategory ?? snapshot.category!, snapshot.neighborhood, snapshot.city, Number(snapshot.privateArea), snapshot.bedrooms);
    return {
      id: curated.id,
      externalId: snapshot.externalCode,
      slug: curated.slug,
      commercial: {
        purpose, type, price: Number(priceValue), area: Number(snapshot.privateArea),
        bedrooms: snapshot.bedrooms ?? undefined, suites: snapshot.suites ?? undefined,
        parkingSpaces: snapshot.parkingSpaces ?? undefined, code: snapshot.externalCode,
      },
      location: { neighborhood: snapshot.neighborhood, city: snapshot.city, state: this.options.defaultState! },
      editorial: {
        title, description, descriptionSource, images,
        features: objectKeys(snapshot.characteristics),
      },
      curation: { published: true, featured: curated.featured, featuredOrder: curated.featuredOrder ?? undefined, collections: collectionSlugs },
    };
  }
}

function normalizedImages(editorialCover: string | null, stored: unknown, fallbackCover: string, title: string): Property["editorial"]["images"] {
  const candidates: { url: string; alt: string }[] = [];
  if (editorialCover) candidates.push({ url: editorialCover, alt: `Imagem de destaque — ${title}` });
  if (Array.isArray(stored)) {
    for (const item of stored) {
      if (item && typeof item === "object" && "url" in item && typeof item.url === "string") {
        candidates.push({ url: item.url, alt: "alt" in item && typeof item.alt === "string" ? item.alt : title });
      }
    }
  }
  candidates.push({ url: fallbackCover, alt: `Imagem de destaque — ${title}` });
  return candidates.filter((image) => isHttps(image.url)).filter((image, index, all) => all.findIndex((candidate) => candidate.url === image.url) === index);
}

function neutralDescription(category: string, neighborhood: string, city: string, area: number, bedrooms: number | null): string {
  const rooms = bedrooms && bedrooms > 0 ? `, com ${bedrooms} dormitório${bedrooms === 1 ? "" : "s"}` : "";
  return `${category} em ${neighborhood}, ${city}, com ${area} m² de área privativa${rooms}. Consulte a equipe Vitória Maison para informações adicionais confirmadas.`;
}

function isHttps(value: string): boolean { try { return new URL(value).protocol === "https:"; } catch { return false; } }

function objectKeys(value: unknown): string[] {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([name]) => name)
    : [];
}
