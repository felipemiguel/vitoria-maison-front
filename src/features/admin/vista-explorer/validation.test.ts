import { describe, expect, it } from "vitest";
import { buildVistaFilters, bulkImportInputSchema, parseExplorerFilters } from "./validation";

describe("Vista explorer validation", () => {
  it("normaliza paginação e filtros da URL", () => {
    expect(parseExplorerFilters({ page: "2", pageSize: "50", city: " São Paulo ", view: "list" })).toMatchObject({ page: 2, pageSize: 50, city: "São Paulo", view: "list" });
  });

  it("converte filtros somente para campos permitidos do Vista", () => {
    const filters = parseExplorerFilters({ city: "São", minPrice: "1000", maxPrice: "5000", bedrooms: "2" });
    expect(buildVistaFilters(filters)).toEqual({ filter: { Cidade: ["like", "São"], Dormitorios: 2 }, advFilter: { Or: { ValorVenda: [1000, 5000], ValorLocacao: [1000, 5000] } } });
  });

  it("rejeita faixa invertida e lote maior que vinte", () => {
    expect(() => parseExplorerFilters({ minPrice: "10", maxPrice: "1" })).toThrow();
    expect(() => bulkImportInputSchema.parse({ idempotencyKey: crypto.randomUUID(), codes: Array.from({ length: 21 }, (_, index) => String(index)) })).toThrow();
  });
});
