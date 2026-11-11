import type { ImportResult } from "@/features/admin/properties/types";
import { sanitizeForLog, toSanitizedError } from "@/integrations/vista/vista-errors";
import { bulkImportInputSchema } from "./validation";
import type { BulkImportItemResult, BulkImportResult } from "./types";

export interface BulkPropertyImporter {
  importVistaProperty(code: string): Promise<ImportResult>;
}

export interface BulkImportStore {
  claim(adminUserId: string, idempotencyKey: string, codes: string[]): Promise<{ batchId: string; completed?: BulkImportResult }>;
  complete(batchId: string, result: BulkImportResult): Promise<void>;
  auditImported(adminUserId: string, propertyId: string, code: string, batchId: string): Promise<void>;
}

export class BulkPropertyImportService {
  constructor(private readonly importer: BulkPropertyImporter, private readonly store: BulkImportStore, private readonly concurrency = 2) {}

  async execute(input: unknown, adminUserId: string): Promise<BulkImportResult> {
    const data = bulkImportInputSchema.parse(input);
    const claim = await this.store.claim(adminUserId, data.idempotencyKey, data.codes);
    if (claim.completed) return claim.completed;
    const items = await mapWithConcurrency(data.codes, this.concurrency, async (code): Promise<BulkImportItemResult> => {
      try {
        const result = await this.importer.importVistaProperty(code);
        const status = result.status === "IMPORTED" ? "IMPORTED" : "EXISTING";
        if (status === "IMPORTED") await this.store.auditImported(adminUserId, result.id, code, claim.batchId);
        return { code, status, id: result.id };
      } catch (error) {
        console.error(JSON.stringify(sanitizeForLog({
          level: "error",
          event: "admin.vista.bulk_import.item_failed",
          batchId: claim.batchId,
          propertyCode: code,
          error: diagnosticError(error),
        })));
        return { code, status: "FAILED", message: safeFailure(error) };
      }
    });
    const imported = items.filter((item) => item.status === "IMPORTED").length;
    const existing = items.filter((item) => item.status === "EXISTING").length;
    const failed = items.filter((item) => item.status === "FAILED").length;
    const result: BulkImportResult = {
      batchId: claim.batchId,
      status: failed === 0 ? "SUCCESS" : imported + existing === 0 ? "FAILED" : "PARTIAL",
      total: items.length, imported, existing, failed, items,
    };
    await this.store.complete(claim.batchId, result);
    return result;
  }
}

function diagnosticError(error: unknown): Record<string, unknown> {
  const diagnostic = toSanitizedError(error);
  if (!(error instanceof Error) || !(error.cause instanceof Error)) return diagnostic;
  return { ...diagnostic, cause: toSanitizedError(error.cause) };
}

function safeFailure(error: unknown): string {
  if (error instanceof Error && /não encontrado|indisponível|tempo limite|inválid|Vista/i.test(error.message)) return error.message.slice(0, 240);
  return "Não foi possível importar este imóvel.";
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, operation: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await operation(items[index]); }
  }));
  return results;
}
