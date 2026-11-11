import { desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { curatedProperties, propertySnapshots, syncRuns } from "@/database/schema";
import type { PropertyCommercialData } from "../types";
import type { CuratedSelection, PropertySyncStore, SyncRunSummary } from "./types";

export class DrizzlePropertySyncStore implements PropertySyncStore {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async ensureCurated(code: string): Promise<{ selection: CuratedSelection; created: boolean }> {
    const normalized = code.trim();
    const inserted = await this.db.insert(curatedProperties).values({
      vistaCode: normalized,
      slug: `vista-${normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
      published: false,
    }).onConflictDoNothing({ target: curatedProperties.vistaCode }).returning();
    const row = inserted[0] ?? (await this.db.select().from(curatedProperties).where(eq(curatedProperties.vistaCode, normalized)).limit(1))[0];
    if (!row) throw new Error("Não foi possível criar ou localizar a curadoria.");
    return { selection: toSelection(row), created: inserted.length > 0 };
  }

  async findCuratedByCode(code: string): Promise<CuratedSelection | null> {
    const row = (await this.db.select().from(curatedProperties).where(eq(curatedProperties.vistaCode, code.trim())).limit(1))[0];
    return row ? toSelection(row) : null;
  }

  async listCurated(): Promise<CuratedSelection[]> {
    return (await this.db.select().from(curatedProperties).orderBy(desc(curatedProperties.updatedAt))).map(toSelection);
  }

  async saveSnapshot(curatedPropertyId: string, data: PropertyCommercialData): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(propertySnapshots).values({
        curatedPropertyId,
        externalCode: data.externalCode,
        category: data.category,
        city: data.city,
        neighborhood: data.neighborhood,
        salePrice: decimal(data.salePrice),
        rentalPrice: decimal(data.rentalPrice),
        privateArea: decimal(data.privateArea),
        totalArea: decimal(data.totalArea),
        bedrooms: integer(data.bedrooms),
        suites: integer(data.suites),
        parkingSpaces: integer(data.parkingSpaces),
        coverImageUrl: data.coverImageUrl,
        images: data.images,
        characteristics: data.characteristics,
        infrastructure: data.infrastructure,
        rawCategory: data.rawCategory,
        sourceTitle: data.sourceTitle,
        sourceDescription: data.sourceDescription,
        sourcePurpose: data.sourcePurpose,
        availabilityStatus: data.availabilityStatus,
        sourceUpdatedAt: data.sourceUpdatedAt,
        fetchedAt: data.fetchedAt,
        syncStatus: "SUCCESS",
      }).onConflictDoUpdate({
        target: propertySnapshots.curatedPropertyId,
        set: {
          category: data.category, city: data.city, neighborhood: data.neighborhood,
          salePrice: decimal(data.salePrice), rentalPrice: decimal(data.rentalPrice),
          privateArea: decimal(data.privateArea), totalArea: decimal(data.totalArea),
          bedrooms: integer(data.bedrooms), suites: integer(data.suites), parkingSpaces: integer(data.parkingSpaces),
          coverImageUrl: data.coverImageUrl, images: data.images,
          characteristics: data.characteristics, infrastructure: data.infrastructure,
          rawCategory: data.rawCategory, sourceTitle: data.sourceTitle, sourceDescription: data.sourceDescription, sourcePurpose: data.sourcePurpose, availabilityStatus: data.availabilityStatus,
          sourceUpdatedAt: data.sourceUpdatedAt, fetchedAt: data.fetchedAt, syncStatus: "SUCCESS",
        },
      });
      await tx.update(curatedProperties).set({
        updatedAt: new Date(), publicationVersion: sql`${curatedProperties.publicationVersion} + 1`,
        lastSyncStatus: "SUCCESS", lastSyncError: null, lastSyncAttemptAt: data.fetchedAt,
      }).where(eq(curatedProperties.id, curatedPropertyId));
    });
  }

  async recordSyncFailure(code: string, message: string, attemptedAt: Date): Promise<void> {
    await this.db.update(curatedProperties).set({
      lastSyncStatus: "FAILED", lastSyncError: message.slice(0, 500), lastSyncAttemptAt: attemptedAt,
      updatedAt: attemptedAt, publicationVersion: sql`${curatedProperties.publicationVersion} + 1`,
    }).where(eq(curatedProperties.vistaCode, code.trim()));
  }

  async startRun(): Promise<string> {
    const row = (await this.db.insert(syncRuns).values({ status: "RUNNING" }).returning({ id: syncRuns.id }))[0];
    if (!row) throw new Error("Não foi possível iniciar a execução de sincronização.");
    return row.id;
  }

  async finishRun(id: string, result: { status: "SUCCESS" | "PARTIAL" | "FAILED"; totalProcessed: number; totalSuccess: number; totalFailed: number; errorSummary?: string }): Promise<void> {
    await this.db.update(syncRuns).set({ ...result, errorSummary: result.errorSummary?.slice(0, 2_000), finishedAt: new Date() }).where(eq(syncRuns.id, id));
  }

  async listRuns(limit = 10): Promise<SyncRunSummary[]> {
    return this.db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(Math.min(100, Math.max(1, limit)));
  }
}

function toSelection(row: typeof curatedProperties.$inferSelect): CuratedSelection {
  return { id: row.id, vistaCode: row.vistaCode, slug: row.slug, published: row.published };
}
function decimal(value: number | undefined): string | null { return value === undefined ? null : String(value); }
function integer(value: number | undefined): number | null { return value === undefined ? null : Math.trunc(value); }
