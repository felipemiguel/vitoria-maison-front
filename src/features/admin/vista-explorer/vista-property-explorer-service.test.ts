import { describe, expect, it, vi } from "vitest";
import type { VistaClient } from "@/integrations/vista/vista-types";
import { VistaPropertyExplorerService, type VistaImportStatusStore } from "./vista-property-explorer-service";
import { parseExplorerFilters } from "./validation";

const record = { Codigo: "31", Categoria: "Apartamento", Cidade: "São Paulo", Bairro: "Centro", ValorVenda: "1000000", ValorLocacao: "", Dormitorios: "3", Suites: "1", Vagas: "2", AreaTotal: "180", AreaPrivativa: "140", FotoDestaque: "https://cdn.example.test/31.jpg" };

describe("VistaPropertyExplorerService", () => {
  it("consulta uma página e identifica importados em lote", async () => {
    const vista: VistaClient = { listProperties: vi.fn(async () => ({ 0: record, total: 1, paginas: 1, pagina: 1, quantidade: 20 })), getPropertyDetails: vi.fn() };
    const statuses: VistaImportStatusStore = { findByCodes: vi.fn(async () => new Map([["31", { kind: "DRAFT" as const, id: "property-id" }]])) };
    const result = await new VistaPropertyExplorerService(vista, statuses, "cdn.example.test").list(parseExplorerFilters({}));
    expect(result.items[0]?.importStatus).toEqual({ kind: "DRAFT", id: "property-id" });
    expect(statuses.findByCodes).toHaveBeenCalledWith(["31"]);
    expect(vista.listProperties).toHaveBeenCalledOnce();
  });

  it("propaga erro do Vista sem consultar status local", async () => {
    const vista: VistaClient = { listProperties: vi.fn(async () => { throw new Error("Vista offline"); }), getPropertyDetails: vi.fn() };
    const statuses: VistaImportStatusStore = { findByCodes: vi.fn() };
    await expect(new VistaPropertyExplorerService(vista, statuses).list(parseExplorerFilters({}))).rejects.toThrow("Vista offline");
    expect(statuses.findByCodes).not.toHaveBeenCalled();
  });
});
