import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminAuditEvents, collectionProperties, collectionSlugRedirects, collections, curatedProperties, propertySnapshots } from "@/database/schema";
import { collectionInputSchema } from "../curation/validation";
import { AdminConcurrencyError } from "../curation/admin-curation-service";

export type AdminCollection = typeof collections.$inferSelect & { propertyCount: number };

export class AdminCollectionService {
  constructor(private readonly db: NodePgDatabase<typeof schema>, private readonly revalidate: () => Promise<void>) {}

  async list(): Promise<AdminCollection[]> {
    const rows = await this.db.select({ collection: collections, propertyCount: count(collectionProperties.curatedPropertyId) }).from(collections)
      .leftJoin(collectionProperties, eq(collectionProperties.collectionId, collections.id)).groupBy(collections.id).orderBy(asc(collections.sortOrder), asc(collections.name));
    return rows.map((row) => ({ ...row.collection, propertyCount: Number(row.propertyCount) }));
  }

  async get(id: string) {
    const collection = (await this.db.select().from(collections).where(eq(collections.id, id)).limit(1))[0];
    if (!collection) return null;
    const associated = await this.db.select({ id: curatedProperties.id, title: curatedProperties.editorialTitle, sourceTitle: propertySnapshots.sourceTitle, vistaCode: curatedProperties.vistaCode, sortOrder: collectionProperties.sortOrder })
      .from(collectionProperties).innerJoin(curatedProperties, eq(curatedProperties.id, collectionProperties.curatedPropertyId))
      .leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id)).where(eq(collectionProperties.collectionId, id)).orderBy(asc(collectionProperties.sortOrder));
    const available = await this.db.select({ id: curatedProperties.id, title: curatedProperties.editorialTitle, sourceTitle: propertySnapshots.sourceTitle, vistaCode: curatedProperties.vistaCode })
      .from(curatedProperties).leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id)).orderBy(asc(curatedProperties.vistaCode));
    return { collection, associated, available };
  }

  async create(input: unknown, adminUserId: string): Promise<string> {
    const data = collectionInputSchema.parse(input);
    const created = await this.db.transaction(async (tx) => {
      const row = (await tx.insert(collections).values({ name: data.name, slug: data.slug, description: data.description, coverImageUrl: data.coverImageUrl, published: data.published, sortOrder: data.sortOrder }).returning())[0];
      await tx.insert(adminAuditEvents).values({ adminUserId, entityType: "COLLECTION", entityId: row.id, action: "COLLECTION_CREATED", afterState: collectionState(row) });
      return row;
    });
    await this.revalidate(); return created.id;
  }

  async update(input: unknown, adminUserId: string): Promise<void> {
    const data = collectionInputSchema.extend({ id: collectionInputSchema.shape.id.unwrap(), version: collectionInputSchema.shape.version.unwrap() }).parse(input);
    await this.db.transaction(async (tx) => {
      const before = (await tx.select().from(collections).where(eq(collections.id, data.id)).limit(1))[0]; if (!before) throw new Error("Coleção não encontrada.");
      const changed = await tx.update(collections).set({ name: data.name, slug: data.slug, description: data.description, coverImageUrl: data.coverImageUrl, published: data.published, sortOrder: data.sortOrder, version: sql`${collections.version} + 1`, updatedAt: new Date() })
        .where(and(eq(collections.id, data.id), eq(collections.version, data.version))).returning();
      if (!changed[0]) throw new AdminConcurrencyError("A coleção foi alterada por outra pessoa. Recarregue a página.");
      await recordSlugChange(tx, data.id, before.slug, changed[0].slug);
      await tx.insert(adminAuditEvents).values({ adminUserId, entityType: "COLLECTION", entityId: data.id, action: "COLLECTION_UPDATED", beforeState: collectionState(before), afterState: collectionState(changed[0]) });
    }); await this.revalidate();
  }

  async setProperties(collectionId: string, version: number, entries: { propertyId: string; order: number }[], adminUserId: string): Promise<void> {
    const ids = entries.map((entry) => entry.propertyId); if (new Set(ids).size !== ids.length) throw new Error("Imóvel duplicado na coleção.");
    await this.db.transaction(async (tx) => {
      const beforeCollection = (await tx.select().from(collections).where(eq(collections.id, collectionId)).limit(1))[0]; if (!beforeCollection) throw new Error("Coleção não encontrada.");
      const locked = await tx.update(collections).set({ version: sql`${collections.version} + 1`, updatedAt: new Date() }).where(and(eq(collections.id, collectionId), eq(collections.version, version))).returning({ id: collections.id });
      if (!locked[0]) throw new AdminConcurrencyError("A coleção foi alterada por outra pessoa. Recarregue a página.");
      const before = await tx.select({ propertyId: collectionProperties.curatedPropertyId, order: collectionProperties.sortOrder }).from(collectionProperties).where(eq(collectionProperties.collectionId, collectionId));
      if (ids.length) { const valid = await tx.select({ id: curatedProperties.id }).from(curatedProperties).where(inArray(curatedProperties.id, ids)); if (valid.length !== ids.length) throw new Error("Um imóvel selecionado não existe."); }
      await tx.delete(collectionProperties).where(eq(collectionProperties.collectionId, collectionId));
      if (entries.length) await tx.insert(collectionProperties).values(entries.map((entry) => ({ collectionId, curatedPropertyId: entry.propertyId, sortOrder: entry.order })));
      await tx.insert(adminAuditEvents).values({ adminUserId, entityType: "COLLECTION", entityId: collectionId, action: "COLLECTION_PROPERTIES_UPDATED", beforeState: { properties: before }, afterState: { properties: entries } });
    }); await this.revalidate();
  }

  async save(input: unknown, entries: { propertyId: string; order: number }[], adminUserId: string): Promise<void> {
    const data = collectionInputSchema.extend({ id: collectionInputSchema.shape.id.unwrap(), version: collectionInputSchema.shape.version.unwrap() }).parse(input);
    const ids = entries.map((entry) => entry.propertyId);
    if (new Set(ids).size !== ids.length) throw new Error("Imóvel duplicado na coleção.");
    if (entries.some((entry) => !Number.isInteger(entry.order) || entry.order < 1 || entry.order > 9999)) throw new Error("A ordem dos imóveis é inválida.");
    if (data.published && entries.length === 0) throw new Error("Associe pelo menos um imóvel antes de ativar a coleção.");
    await this.db.transaction(async (tx) => {
      const before = (await tx.select().from(collections).where(eq(collections.id, data.id)).limit(1))[0];
      if (!before) throw new Error("Coleção não encontrada.");
      const beforeProperties = await tx.select({ propertyId: collectionProperties.curatedPropertyId, order: collectionProperties.sortOrder }).from(collectionProperties).where(eq(collectionProperties.collectionId, data.id));
      if (ids.length) {
        const valid = await tx.select({ id: curatedProperties.id }).from(curatedProperties).where(inArray(curatedProperties.id, ids));
        if (valid.length !== ids.length) throw new Error("Um imóvel selecionado não existe.");
      }
      const changed = await tx.update(collections).set({ name: data.name, slug: data.slug, description: data.description, coverImageUrl: data.coverImageUrl, published: data.published, sortOrder: data.sortOrder, version: sql`${collections.version} + 1`, updatedAt: new Date() })
        .where(and(eq(collections.id, data.id), eq(collections.version, data.version))).returning();
      if (!changed[0]) throw new AdminConcurrencyError("A coleção foi alterada por outra pessoa. Recarregue a página.");
      await recordSlugChange(tx, data.id, before.slug, changed[0].slug);
      await tx.delete(collectionProperties).where(eq(collectionProperties.collectionId, data.id));
      if (entries.length) await tx.insert(collectionProperties).values(entries.map((entry) => ({ collectionId: data.id, curatedPropertyId: entry.propertyId, sortOrder: entry.order })));
      await tx.insert(adminAuditEvents).values({ adminUserId, entityType: "COLLECTION", entityId: data.id, action: "COLLECTION_SAVED", beforeState: { collection: collectionState(before), properties: beforeProperties }, afterState: { collection: collectionState(changed[0]), properties: entries } });
    });
    await this.revalidate();
  }
}

function collectionState(row: typeof collections.$inferSelect) { return { name: row.name, slug: row.slug, description: row.description, coverImageUrl: row.coverImageUrl, published: row.published, sortOrder: row.sortOrder }; }

type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];

/** Preserva o slug anterior para redirecionamento 301/308 e evita loops quando um slug antigo volta a ser usado. */
async function recordSlugChange(tx: Tx, collectionId: string, previous: string, current: string): Promise<void> {
  await tx.delete(collectionSlugRedirects).where(eq(collectionSlugRedirects.oldSlug, current));
  if (previous === current) return;
  await tx.insert(collectionSlugRedirects).values({ oldSlug: previous, collectionId })
    .onConflictDoUpdate({ target: collectionSlugRedirects.oldSlug, set: { collectionId, createdAt: new Date() } });
}
