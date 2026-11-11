import { and, asc, count, desc, eq, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import * as schema from "@/database/schema";
import { collectionProperties, collections, curatedProperties, propertySnapshots, syncRuns } from "@/database/schema";
import type { PropertySyncService } from "@/features/properties/sync/property-sync-service";
import type { PropertyPublicationService } from "@/features/properties/publication/property-publication-service";
import { publicVisibilityConditions } from "@/features/properties/publication/property-publication-policy";
import type { PublicationPolicyConfig } from "@/features/properties/config";
import type { AdminDashboardStats, AdminPropertyDetails, AdminPropertyFilters, AdminPropertyPage, AdminPropertySummary, ImportResult, VistaPropertyPreviewResult } from "./types";

const codeSchema = z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N}._-]+$/u);
const idSchema = z.string().uuid();

type AdminRow = { curated: typeof curatedProperties.$inferSelect; snapshot: typeof propertySnapshots.$inferSelect | null };

export class AdminPropertyService {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly publication: PropertyPublicationService,
    private readonly sync: PropertySyncService,
    private readonly policyConfig: PublicationPolicyConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(filters: AdminPropertyFilters): Promise<AdminPropertyPage> {
    const page = Math.max(1, filters.page);
    const pageSize = Math.min(50, Math.max(1, filters.pageSize));
    const conditions = this.adminConditions(filters);
    const title = sql<string>`COALESCE(NULLIF(BTRIM(${curatedProperties.editorialTitle}), ''), NULLIF(BTRIM(${propertySnapshots.sourceTitle}), ''), ${`Imóvel` } || ' ' || ${curatedProperties.vistaCode})`;
    const order = filters.sort === "code" ? asc(curatedProperties.vistaCode)
      : filters.sort === "title" ? asc(title)
      : filters.sort === "last-sync" ? desc(curatedProperties.lastSyncAttemptAt)
      : filters.sort === "featured" ? asc(curatedProperties.featuredOrder)
      : desc(curatedProperties.createdAt);
    const [rows, totals] = await Promise.all([
      this.db.select({ curated: curatedProperties, snapshot: propertySnapshots }).from(curatedProperties)
        .leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
        .where(and(...conditions)).orderBy(order).limit(pageSize).offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(curatedProperties)
        .leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id)).where(and(...conditions)),
    ]);
    const eligibleIds = await this.eligibleIds(rows.map((row) => row.curated.id));
    const items = rows.map((row) => this.summary(row, eligibleIds.has(row.curated.id)));
    const total = Number(totals[0]?.total ?? 0);
    return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async getById(id: string): Promise<AdminPropertyDetails | null> {
    const normalized = idSchema.safeParse(id);
    if (!normalized.success) return null;
    const row = (await this.db.select({ curated: curatedProperties, snapshot: propertySnapshots }).from(curatedProperties)
      .leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(eq(curatedProperties.id, normalized.data)).limit(1))[0];
    if (!row) return null;
    const collectionRows = await this.db.select({ slug: collections.slug, name: collections.name }).from(collectionProperties)
      .innerJoin(collections, eq(collections.id, collectionProperties.collectionId))
      .where(eq(collectionProperties.curatedPropertyId, row.curated.id)).orderBy(asc(collectionProperties.sortOrder));
    const eligible = (await this.eligibleIds([row.curated.id])).has(row.curated.id);
    return {
      ...this.summary(row, eligible), featured: row.curated.featured, featuredOrder: row.curated.featuredOrder,
      sourceTitle: row.snapshot?.sourceTitle ?? null, sourceDescription: row.snapshot?.sourceDescription ?? null,
      editorialTitle: row.curated.editorialTitle, editorialDescription: row.curated.editorialDescription,
      rawCategory: row.snapshot?.rawCategory ?? null, privateArea: row.snapshot?.privateArea ?? null, totalArea: row.snapshot?.totalArea ?? null,
      bedrooms: row.snapshot?.bedrooms ?? null, suites: row.snapshot?.suites ?? null, parkingSpaces: row.snapshot?.parkingSpaces ?? null,
      characteristics: row.snapshot?.characteristics ?? {}, infrastructure: row.snapshot?.infrastructure ?? {},
      sourcePurpose: row.snapshot?.sourcePurpose ?? null, sourceUpdatedAt: row.snapshot?.sourceUpdatedAt ?? null,
      availabilityConfirmedAt: row.curated.availabilityConfirmedAt, availabilityConfirmedBy: row.curated.availabilityConfirmedBy,
      lastSyncError: row.curated.lastSyncError, collections: collectionRows,
      publicationStatus: await this.publication.status(row.curated.vistaCode, this.now()),
    };
  }

  async previewVistaProperty(code: string): Promise<VistaPropertyPreviewResult> {
    const normalized = codeSchema.parse(code);
    const existing = (await this.db.select({ id: curatedProperties.id }).from(curatedProperties).where(eq(curatedProperties.vistaCode, normalized)).limit(1))[0];
    if (existing) return { status: "DUPLICATE", id: existing.id, vistaCode: normalized };
    const property = await this.sync.preview(normalized);
    return { status: "READY", property };
  }

  async importVistaProperty(code: string): Promise<ImportResult> {
    const normalized = codeSchema.parse(code);
    const existing = (await this.db.select({ id: curatedProperties.id }).from(curatedProperties).where(eq(curatedProperties.vistaCode, normalized)).limit(1))[0];
    if (existing) return { status: "DUPLICATE", id: existing.id, vistaCode: normalized };
    const result = await this.sync.addAndSync(normalized);
    if (result.result.status !== "SUCCESS") throw new Error(result.result.message ?? "Não foi possível importar o imóvel.");
    const created = (await this.db.select({ id: curatedProperties.id }).from(curatedProperties).where(eq(curatedProperties.vistaCode, normalized)).limit(1))[0];
    if (!created) throw new Error("O imóvel foi sincronizado, mas não foi localizado na curadoria.");
    return { status: result.created ? "IMPORTED" : "DUPLICATE", id: created.id, vistaCode: normalized };
  }

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const now = this.now();
    const visible = publicVisibilityConditions(now, this.policyConfig);
    const [totals, published, attention, errors, eligible, latestSyncRuns, latest] = await Promise.all([
      this.db.select({ value: count() }).from(curatedProperties),
      this.db.select({ value: count() }).from(curatedProperties).where(eq(curatedProperties.published, true)),
      this.db.select({ value: count() }).from(curatedProperties).leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
        .where(or(eq(propertySnapshots.availabilityStatus, "UNKNOWN"), and(eq(propertySnapshots.availabilityStatus, "UNKNOWN"), lte(curatedProperties.availabilityExpiresAt, now)), isNull(propertySnapshots.id))),
      this.db.select({ value: count() }).from(curatedProperties).where(eq(curatedProperties.lastSyncStatus, "FAILED")),
      this.db.select({ value: count() }).from(curatedProperties).innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id)).where(and(...visible)),
      this.db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(5),
      this.list({ page: 1, pageSize: 5, sort: "newest" }),
    ]);
    const total = Number(totals[0]?.value ?? 0);
    const publishedTotal = Number(published[0]?.value ?? 0);
    return {
      selected: total, published: publishedTotal, drafts: total - publishedTotal, publiclyEligible: Number(eligible[0]?.value ?? 0),
      availabilityAttention: Number(attention[0]?.value ?? 0), syncErrors: Number(errors[0]?.value ?? 0),
      latestSync: latestSyncRuns[0] ? { status: latestSyncRuns[0].status, startedAt: latestSyncRuns[0].startedAt, finishedAt: latestSyncRuns[0].finishedAt } : null,
      latestProperties: latest.items,
      latestSyncRuns: latestSyncRuns.map((run) => ({ id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, totalProcessed: run.totalProcessed, totalSuccess: run.totalSuccess, totalFailed: run.totalFailed })),
    };
  }

  private adminConditions(filters: AdminPropertyFilters): SQL[] {
    const conditions: SQL[] = [];
    if (filters.search) conditions.push(or(ilike(curatedProperties.vistaCode, `%${filters.search}%`), ilike(curatedProperties.editorialTitle, `%${filters.search}%`), ilike(propertySnapshots.sourceTitle, `%${filters.search}%`))!);
    if (filters.neighborhood) conditions.push(ilike(propertySnapshots.neighborhood, `%${filters.neighborhood}%`));
    if (filters.publication) conditions.push(eq(curatedProperties.published, filters.publication === "PUBLISHED"));
    if (filters.syncStatus) conditions.push(eq(curatedProperties.lastSyncStatus, filters.syncStatus));
    if (filters.featured !== undefined) conditions.push(eq(curatedProperties.featured, filters.featured));
    if (filters.availability === "EXPIRED") conditions.push(and(eq(propertySnapshots.availabilityStatus, "UNKNOWN"), lte(curatedProperties.availabilityExpiresAt, this.now()))!);
    else if (filters.availability) conditions.push(eq(propertySnapshots.availabilityStatus, filters.availability));
    return conditions;
  }

  private async eligibleIds(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.db.select({ id: curatedProperties.id }).from(curatedProperties)
      .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(and(inArray(curatedProperties.id, ids), ...publicVisibilityConditions(this.now(), this.policyConfig)));
    return new Set(rows.map((row) => row.id));
  }

  private summary(row: AdminRow, publiclyEligible: boolean): AdminPropertySummary {
    const snapshot = row.snapshot;
    return {
      id: row.curated.id, vistaCode: row.curated.vistaCode, publicationVersion: row.curated.publicationVersion,
      title: row.curated.editorialTitle?.trim() || snapshot?.sourceTitle?.trim() || `Imóvel ${row.curated.vistaCode}`,
      neighborhood: snapshot?.neighborhood ?? null, city: snapshot?.city ?? null,
      coverImageUrl: row.curated.editorialCoverUrl ?? snapshot?.coverImageUrl ?? null,
      salePrice: snapshot?.salePrice ?? null, rentalPrice: snapshot?.rentalPrice ?? null,
      publicationPurpose: row.curated.publicationPurpose, published: row.curated.published, publiclyEligible,
      availabilityStatus: snapshot?.availabilityStatus ?? "UNKNOWN", availabilityExpiresAt: row.curated.availabilityExpiresAt,
      lastSyncStatus: row.curated.lastSyncStatus, lastSyncAttemptAt: row.curated.lastSyncAttemptAt,
    };
  }
}
