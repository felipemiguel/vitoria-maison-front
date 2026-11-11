import { describe, expect, it, vi } from "vitest";
import { BulkPropertyImportService, type BulkImportStore } from "./bulk-property-import-service";
import type { BulkImportResult } from "./types";

function store(completed?: BulkImportResult): BulkImportStore {
  return { claim: vi.fn(async () => ({ batchId: "00000000-0000-4000-8000-000000000001", completed })), complete: vi.fn(async () => undefined), auditImported: vi.fn(async () => undefined) };
}

describe("BulkPropertyImportService", () => {
  it("preserva duplicados e continua após falha parcial", async () => {
    const importer = { importVistaProperty: vi.fn(async (code: string) => {
      if (code === "3") throw new Error("Imóvel não encontrado no Vista.");
      return { status: code === "2" ? "DUPLICATE" as const : "IMPORTED" as const, id: `00000000-0000-4000-8000-00000000000${code}`, vistaCode: code };
    }) };
    const persistence = store();
    const result = await new BulkPropertyImportService(importer, persistence, 2).execute({ codes: ["1", "2", "3"], idempotencyKey: "00000000-0000-4000-8000-000000000010" }, "admin");
    expect(result).toMatchObject({ status: "PARTIAL", imported: 1, existing: 1, failed: 1 });
    expect(persistence.complete).toHaveBeenCalledOnce();
    expect(persistence.auditImported).toHaveBeenCalledOnce();
  });

  it("retorna o resultado anterior sem repetir importações", async () => {
    const previous: BulkImportResult = { batchId: "batch", status: "SUCCESS", total: 1, imported: 1, existing: 0, failed: 0, items: [{ code: "1", status: "IMPORTED" }] };
    const importer = { importVistaProperty: vi.fn() };
    const result = await new BulkPropertyImportService(importer, store(previous)).execute({ codes: ["1"], idempotencyKey: "00000000-0000-4000-8000-000000000010" }, "admin");
    expect(result).toEqual(previous);
    expect(importer.importVistaProperty).not.toHaveBeenCalled();
  });
});
