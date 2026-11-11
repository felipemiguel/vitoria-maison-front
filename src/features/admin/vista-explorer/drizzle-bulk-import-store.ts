import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminAuditEvents, adminBulkImports } from "@/database/schema";
import type { BulkImportStore } from "./bulk-property-import-service";
import type { BulkImportResult } from "./types";

export class DrizzleBulkImportStore implements BulkImportStore {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async claim(adminUserId: string, idempotencyKey: string, codes: string[]) {
    const inserted = await this.db.insert(adminBulkImports).values({ adminUserId, idempotencyKey, requestedCodes: codes, total: codes.length })
      .onConflictDoNothing().returning({ id: adminBulkImports.id });
    if (inserted[0]) return { batchId: inserted[0].id };
    const existing = (await this.db.select().from(adminBulkImports).where(and(eq(adminBulkImports.adminUserId, adminUserId), eq(adminBulkImports.idempotencyKey, idempotencyKey))).limit(1))[0];
    if (!existing) throw new Error("Não foi possível iniciar a importação em lote.");
    if (existing.status === "RUNNING") throw new Error("Este lote já está em processamento.");
    return { batchId: existing.id, completed: toResult(existing) };
  }

  async complete(batchId: string, result: BulkImportResult): Promise<void> {
    await this.db.update(adminBulkImports).set({ status: result.status, imported: result.imported, existing: result.existing, failed: result.failed, results: result.items, finishedAt: new Date() }).where(eq(adminBulkImports.id, batchId));
  }

  async auditImported(adminUserId: string, propertyId: string, code: string, batchId: string): Promise<void> {
    await this.db.insert(adminAuditEvents).values({ adminUserId, entityType: "PROPERTY", entityId: propertyId, action: "BULK_IMPORTED", beforeState: {}, afterState: { code, batchId, published: false } });
  }
}

function toResult(row: typeof adminBulkImports.$inferSelect): BulkImportResult {
  return { batchId: row.id, status: row.status as BulkImportResult["status"], total: row.total, imported: row.imported, existing: row.existing, failed: row.failed, items: row.results as BulkImportResult["items"] };
}
