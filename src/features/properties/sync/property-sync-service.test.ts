import { describe, expect, it } from "vitest";
import { vistaPropertyFixture } from "@/integrations/vista/__fixtures__/property";
import type { VistaClient } from "@/integrations/vista/vista-types";
import type { PropertyCommercialData } from "../types";
import { PropertySyncService } from "./property-sync-service";
import type { CuratedSelection, PropertySyncStore, SyncRunSummary } from "./types";

class MemoryStore implements PropertySyncStore {
  selections = new Map<string, CuratedSelection>();
  snapshots = new Map<string, PropertyCommercialData>();
  runs: SyncRunSummary[] = [];
  async ensureCurated(code: string) { const existing = this.selections.get(code); if (existing) return { selection: existing, created: false }; const selection = { id: `id-${code}`, vistaCode: code, slug: `vista-${code}`, published: false }; this.selections.set(code, selection); return { selection, created: true }; }
  async findCuratedByCode(code: string) { return this.selections.get(code) ?? null; }
  async listCurated() { return [...this.selections.values()]; }
  async saveSnapshot(id: string, data: PropertyCommercialData) { this.snapshots.set(id, data); }
  async recordSyncFailure() {}
  async startRun() { const id = `run-${this.runs.length}`; this.runs.push({ id, status: "RUNNING", startedAt: new Date(), finishedAt: null, totalProcessed: 0, totalSuccess: 0, totalFailed: 0, errorSummary: null }); return id; }
  async finishRun(id: string, result: { status: "SUCCESS" | "PARTIAL" | "FAILED"; totalProcessed: number; totalSuccess: number; totalFailed: number; errorSummary?: string }) { const run = this.runs.find((item) => item.id === id)!; Object.assign(run, result, { finishedAt: new Date(), errorSummary: result.errorSummary ?? null }); }
  async listRuns() { return this.runs; }
}

const vista = (response: unknown): VistaClient => ({ listProperties: async () => [], getPropertyDetails: async () => response });

describe("PropertySyncService", () => {
  it("gera prévia sem criar curadoria ou snapshot", async () => {
    const store = new MemoryStore();
    const preview = await new PropertySyncService(vista(vistaPropertyFixture), store).preview("VM-TESTE-01");
    expect(preview.externalCode).toBe("VM-TESTE-01");
    expect(store.selections).toHaveLength(0);
    expect(store.snapshots).toHaveLength(0);
  });

  it("adiciona de forma idempotente, sempre unpublished, e persiste snapshot", async () => {
    const store = new MemoryStore();
    const service = new PropertySyncService(vista(vistaPropertyFixture), store);
    expect((await service.addAndSync("VM-TESTE-01")).created).toBe(true);
    expect((await service.addAndSync("VM-TESTE-01")).created).toBe(false);
    expect(store.selections).toHaveLength(1);
    expect(store.selections.get("VM-TESTE-01")?.published).toBe(false);
    expect(store.snapshots.get("id-VM-TESTE-01")?.salePrice).toBe(1_250_000);
  });

  it("aceita identificador de consulta diferente do código comercial retornado pelo Vista", async () => {
    const store = new MemoryStore();
    const response = { ...vistaPropertyFixture, Codigo: "9107" };
    const result = await new PropertySyncService(vista(response), store).addAndSync("16486838");
    expect(result.result.status).toBe("SUCCESS");
    expect(store.selections.get("16486838")?.vistaCode).toBe("16486838");
    expect(store.snapshots.get("id-16486838")?.externalCode).toBe("9107");
  });

  it("atualiza snapshot sem alterar curadoria", async () => {
    const store = new MemoryStore();
    const original = { id: "id-1", vistaCode: "1", slug: "editorial", published: true };
    store.selections.set("1", original);
    const service = new PropertySyncService(vista({ ...vistaPropertyFixture, Codigo: "1", ValorVenda: "2000000" }), store);
    expect((await service.syncOne("1")).status).toBe("SUCCESS");
    expect(store.snapshots.get("id-1")?.salePrice).toBe(2_000_000);
    expect(store.selections.get("1")).toEqual(original);
  });

  it("falha temporária preserva snapshot anterior", async () => {
    const store = new MemoryStore();
    store.selections.set("1", { id: "id-1", vistaCode: "1", slug: "vista-1", published: false });
    store.snapshots.set("id-1", { externalCode: "1", city: "São Paulo", neighborhood: "Moema", salePrice: 100, images: [], characteristics: {}, infrastructure: {}, availabilityStatus: "UNKNOWN", fetchedAt: new Date() });
    const failingVista: VistaClient = { listProperties: async () => [], getPropertyDetails: async () => { throw new TypeError("network"); } };
    const result = await new PropertySyncService(failingVista, store).syncOne("1");
    expect(result.status).toBe("TEMPORARY_FAILURE");
    expect(store.snapshots.get("id-1")?.salePrice).toBe(100);
  });

  it("não cria curadoria quando o Vista retorna resposta inválida", async () => {
    const store = new MemoryStore();
    const result = await new PropertySyncService(vista({ Codigo: "x" }), store).addAndSync("x");
    expect(result.result.status).toBe("INVALID_RESPONSE");
    expect(store.selections).toHaveLength(0);
  });

  it("propaga falha da API na prévia sem persistir dados", async () => {
    const store = new MemoryStore();
    const failing: VistaClient = { listProperties: async () => [], getPropertyDetails: async () => { throw new TypeError("network"); } };
    await expect(new PropertySyncService(failing, store).preview("1")).rejects.toThrow();
    expect(store.selections).toHaveLength(0);
  });
});
