import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { curatedProperties, propertyPublicationEvents, propertySnapshots } from "@/database/schema";
import type { ManualAvailabilityConfirmation, PropertyPublicationStore, PublicationRecord } from "./types";

export class DrizzlePropertyPublicationStore implements PropertyPublicationStore {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async load(code: string): Promise<PublicationRecord | null> {
    const row = (await this.db.select({ curated: curatedProperties, snapshot: propertySnapshots })
      .from(curatedProperties)
      .leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(eq(curatedProperties.vistaCode, code.trim())).limit(1))[0];
    if (!row) return null;
    return {
      id: row.curated.id,
      vistaCode: row.curated.vistaCode,
      updatedAt: row.curated.updatedAt,
      publicationVersion: row.curated.publicationVersion,
      published: row.curated.published,
      publicationPurpose: row.curated.publicationPurpose,
      editorialTitle: row.curated.editorialTitle,
      sourceTitle: row.snapshot?.sourceTitle ?? null,
      editorialCoverUrl: row.curated.editorialCoverUrl,
      availabilityConfirmedAt: row.curated.availabilityConfirmedAt,
      availabilityExpiresAt: row.curated.availabilityExpiresAt,
      availabilityConfirmedBy: row.curated.availabilityConfirmedBy,
      availabilityConfirmationSource: row.curated.availabilityConfirmationSource,
      snapshot: row.snapshot ? {
        syncStatus: row.snapshot.syncStatus,
        availabilityStatus: row.snapshot.availabilityStatus,
        fetchedAt: row.snapshot.fetchedAt,
        salePrice: row.snapshot.salePrice,
        rentalPrice: row.snapshot.rentalPrice,
        privateArea: row.snapshot.privateArea,
        category: row.snapshot.category,
        coverImageUrl: row.snapshot.coverImageUrl,
      } : null,
    };
  }

  async confirmAvailability(code: string, expectedVersion: number, confirmation: ManualAvailabilityConfirmation): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const before = (await tx.select({ confirmedAt: curatedProperties.availabilityConfirmedAt, expiresAt: curatedProperties.availabilityExpiresAt, confirmedBy: curatedProperties.availabilityConfirmedBy, source: curatedProperties.availabilityConfirmationSource })
        .from(curatedProperties).where(and(eq(curatedProperties.vistaCode, code.trim()), eq(curatedProperties.publicationVersion, expectedVersion))).limit(1))[0];
      const changed = await tx.update(curatedProperties).set({
        availabilityConfirmedAt: confirmation.confirmedAt,
        availabilityExpiresAt: confirmation.expiresAt,
        availabilityConfirmedBy: confirmation.confirmedBy,
        availabilityConfirmationSource: confirmation.source,
        publicationVersion: sql`${curatedProperties.publicationVersion} + 1`,
        updatedAt: confirmation.confirmedAt,
      }).where(and(eq(curatedProperties.vistaCode, code.trim()), eq(curatedProperties.publicationVersion, expectedVersion))).returning({ id: curatedProperties.id });
      if (!changed[0]) return false;
      await tx.insert(propertyPublicationEvents).values({
        curatedPropertyId: changed[0].id,
        eventType: "AVAILABILITY_CONFIRMED",
        actor: confirmation.confirmedBy,
        details: { before, after: { confirmedAt: confirmation.confirmedAt.toISOString(), expiresAt: confirmation.expiresAt.toISOString(), confirmedBy: confirmation.confirmedBy, source: confirmation.source } },
      });
      return true;
    });
  }

  async clearAvailabilityConfirmation(code: string, expectedVersion: number, actor: string, changedAt: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const before = (await tx.select({ confirmedAt: curatedProperties.availabilityConfirmedAt, expiresAt: curatedProperties.availabilityExpiresAt, confirmedBy: curatedProperties.availabilityConfirmedBy, source: curatedProperties.availabilityConfirmationSource })
        .from(curatedProperties).where(and(eq(curatedProperties.vistaCode, code.trim()), eq(curatedProperties.publicationVersion, expectedVersion))).limit(1))[0];
      const changed = await tx.update(curatedProperties).set({
        availabilityConfirmedAt: null, availabilityExpiresAt: null, availabilityConfirmedBy: null, availabilityConfirmationSource: null,
        publicationVersion: sql`${curatedProperties.publicationVersion} + 1`, updatedAt: changedAt,
      }).where(and(eq(curatedProperties.vistaCode, code.trim()), eq(curatedProperties.publicationVersion, expectedVersion))).returning({ id: curatedProperties.id });
      if (!changed[0]) return false;
      await tx.insert(propertyPublicationEvents).values({ curatedPropertyId: changed[0].id, eventType: "AVAILABILITY_CLEARED", actor, details: { before, after: { confirmedAt: null, expiresAt: null, confirmedBy: null, source: null } } });
      return true;
    });
  }

  async setPublished(code: string, published: boolean, expectedVersion: number, actor: string, details: Record<string, unknown> = {}): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const changedAt = new Date();
      const changed = await tx.update(curatedProperties).set({
        published,
        publicationVersion: sql`${curatedProperties.publicationVersion} + 1`,
        updatedAt: changedAt,
      }).where(and(eq(curatedProperties.vistaCode, code.trim()), eq(curatedProperties.publicationVersion, expectedVersion))).returning({ id: curatedProperties.id });
      if (!changed[0]) return false;
      await tx.insert(propertyPublicationEvents).values({
        curatedPropertyId: changed[0].id,
        eventType: published ? "PUBLISHED" : "UNPUBLISHED",
        actor,
        details,
      });
      return true;
    });
  }
}
