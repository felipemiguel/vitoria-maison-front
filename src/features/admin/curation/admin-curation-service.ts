import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminAuditEvents, curatedProperties, propertySnapshots } from "@/database/schema";
import { publicVisibilityConditions } from "@/features/properties/publication/property-publication-policy";
import type { PublicationPolicyConfig } from "@/features/properties/config";
import { editorialInputSchema, featuredInputSchema } from "./validation";

export class AdminConcurrencyError extends Error {}

export class AdminCurationService {
  constructor(private readonly db: NodePgDatabase<typeof schema>, private readonly policy: PublicationPolicyConfig, private readonly revalidate: () => Promise<void>) {}

  async updateEditorial(input: unknown, adminUserId: string): Promise<void> {
    const data = editorialInputSchema.parse(input);
    await this.db.transaction(async (tx) => {
      const before = (await tx.select().from(curatedProperties).where(eq(curatedProperties.id, data.id)).limit(1))[0];
      if (!before) throw new Error("Imóvel não encontrado.");
      const snapshot = (await tx.select().from(propertySnapshots).where(eq(propertySnapshots.curatedPropertyId, data.id)).limit(1))[0];
      if (data.purpose === "RENT" && (!snapshot?.rentalPrice || Number(snapshot.rentalPrice) <= 0)) throw new Error("O imóvel não possui preço de locação válido.");
      if ((data.purpose === "SALE" || data.purpose === "INVESTMENT") && (!snapshot?.salePrice || Number(snapshot.salePrice) <= 0)) throw new Error("O imóvel não possui preço de venda válido.");
      const changed = await tx.update(curatedProperties).set({
        editorialTitle: data.title, editorialDescription: data.description, publicationPurpose: data.purpose,
        editorialCoverUrl: data.coverUrl, publicationVersion: sql`${curatedProperties.publicationVersion} + 1`, updatedAt: new Date(),
      }).where(and(eq(curatedProperties.id, data.id), eq(curatedProperties.publicationVersion, data.version))).returning({ id: curatedProperties.id });
      if (!changed[0]) throw new AdminConcurrencyError("O imóvel foi alterado por outra pessoa. Recarregue a página.");
      await tx.insert(adminAuditEvents).values({ adminUserId, entityType: "PROPERTY", entityId: data.id, action: "EDITORIAL_UPDATED", beforeState: editorialState(before), afterState: { title: data.title, description: data.description, purpose: data.purpose, coverUrl: data.coverUrl } });
    });
    await this.revalidate();
  }

  async updateFeatured(input: unknown, adminUserId: string): Promise<void> {
    const data = featuredInputSchema.parse(input);
    if (data.featured) {
      const eligible = await this.db.select({ id: curatedProperties.id }).from(curatedProperties)
        .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
        .where(and(eq(curatedProperties.id, data.id), ...publicVisibilityConditions(new Date(), this.policy))).limit(1);
      if (!eligible[0]) throw new Error("Somente imóveis publicados e elegíveis podem ser destacados.");
    }
    await this.db.transaction(async (tx) => {
      const before = (await tx.select().from(curatedProperties).where(eq(curatedProperties.id, data.id)).limit(1))[0];
      if (!before) throw new Error("Imóvel não encontrado.");
      const changed = await tx.update(curatedProperties).set({ featured: data.featured, featuredOrder: data.featured ? data.order : null, publicationVersion: sql`${curatedProperties.publicationVersion} + 1`, updatedAt: new Date() })
        .where(and(eq(curatedProperties.id, data.id), eq(curatedProperties.publicationVersion, data.version))).returning({ id: curatedProperties.id });
      if (!changed[0]) throw new AdminConcurrencyError("O imóvel foi alterado por outra pessoa. Recarregue a página.");
      await tx.insert(adminAuditEvents).values({ adminUserId, entityType: "PROPERTY", entityId: data.id, action: data.featured ? "FEATURED_ENABLED" : "FEATURED_DISABLED", beforeState: { featured: before.featured, order: before.featuredOrder }, afterState: { featured: data.featured, order: data.featured ? data.order : null } });
    });
    await this.revalidate();
  }

  async reorderFeatured(entries: { id: string; order: number }[], adminUserId: string): Promise<void> {
    const ids = entries.map((entry) => entry.id);
    if (!ids.length || new Set(ids).size !== ids.length || entries.some((entry) => !Number.isInteger(entry.order) || entry.order < 1)) throw new Error("Ordem de destaques inválida.");
    await this.db.transaction(async (tx) => {
      const before = await tx.select({ id: curatedProperties.id, order: curatedProperties.featuredOrder }).from(curatedProperties).where(and(inArray(curatedProperties.id, ids), eq(curatedProperties.featured, true)));
      if (before.length !== entries.length) throw new Error("Um dos destaques não está mais disponível.");
      for (const entry of entries) await tx.update(curatedProperties).set({ featuredOrder: entry.order, publicationVersion: sql`${curatedProperties.publicationVersion} + 1`, updatedAt: new Date() }).where(eq(curatedProperties.id, entry.id));
      for (const entry of entries) await tx.insert(adminAuditEvents).values({ adminUserId, entityType: "PROPERTY", entityId: entry.id, action: "FEATURED_REORDERED", beforeState: { order: before.find((item) => item.id === entry.id)?.order }, afterState: { order: entry.order } });
    });
    await this.revalidate();
  }

  async recordSync(id: string, adminUserId: string, before: unknown, after: unknown): Promise<void> {
    await this.db.insert(adminAuditEvents).values({ adminUserId, entityType: "PROPERTY", entityId: id, action: "SYNC_REQUESTED", beforeState: before as Record<string, unknown>, afterState: after as Record<string, unknown> });
  }
}

function editorialState(row: typeof curatedProperties.$inferSelect) { return { title: row.editorialTitle, description: row.editorialDescription, purpose: row.publicationPurpose, coverUrl: row.editorialCoverUrl }; }
