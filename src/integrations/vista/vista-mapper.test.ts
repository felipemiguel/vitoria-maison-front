import { describe, expect, it } from "vitest";
import { vistaPropertyFixture } from "./__fixtures__/property";
import { mapVistaProperty, normalizeVistaCommercialData, parseVistaPropertySnapshot } from "./vista-mapper";

describe("mapeamento Vista", () => {
  it("valida e normaliza o snapshot confirmado", () => {
    const snapshot = parseVistaPropertySnapshot(vistaPropertyFixture);
    expect(snapshot.ValorVenda).toBe(1_250_000);
    expect(snapshot.Dormitorios).toBe(2);
  });

  it("preserva ponto decimal em strings numéricas", () => {
    const snapshot = parseVistaPropertySnapshot({ ...vistaPropertyFixture, ValorVenda: "1250000.50" });
    expect(snapshot.ValorVenda).toBe(1_250_000.5);
  });

  it("preserva finalidade de origem sem inferir finalidade editorial", () => {
    const normalized = normalizeVistaCommercialData(vistaPropertyFixture, new Date("2026-11-06T12:00:00.000Z"));
    expect(normalized.sourcePurpose).toBe("Residencial");
    expect(normalized.sourceUpdatedAt?.toISOString()).toBe("2026-11-06T00:00:00.000Z");
    expect(normalized.availabilityStatus).toBe("UNKNOWN");
  });

  it("preserva título e descrição do Vista como conteúdo de origem", () => {
    const normalized = normalizeVistaCommercialData({
      ...vistaPropertyFixture,
      TituloSite: "  Apartamento com vista livre  ",
      DescricaoWeb: "  Descrição publicada no Vista.  ",
    }, new Date("2026-11-06T12:00:00.000Z"));
    expect(normalized.sourceTitle).toBe("Apartamento com vista livre");
    expect(normalized.sourceDescription).toBe("Descrição publicada no Vista.");
  });

  it("recusa dados ausentes", () => expect(() => parseVistaPropertySnapshot({ Codigo: "1" })).toThrow(/campos mínimos/));
  it("recusa criar Property sem contexto não confirmado", () => expect(() => mapVistaProperty(vistaPropertyFixture)).toThrow(/contexto validado/));

  it("mapeia com contexto explícito e mantém curadoria separada", () => {
    const property = mapVistaProperty(vistaPropertyFixture, {
      purpose: "SALE", type: "APARTMENT", area: 82, state: "SP", title: "Imóvel fictício",
      curation: { published: false, featured: false, collections: [] },
    });
    expect(property.externalId).toBe("VM-TESTE-01");
    expect(property.commercial.price).toBe(1_250_000);
    expect(property.curation.published).toBe(false);
    expect(property.editorial.images).toHaveLength(2);
  });

  it("não usa ValorVenda para finalidade diferente de venda", () => expect(() => mapVistaProperty(vistaPropertyFixture, {
    purpose: "RENT", type: "APARTMENT", area: 82, state: "SP", title: "Teste",
    curation: { published: false, featured: false, collections: [] },
  })).toThrow(/ValorVenda/));

  it("mantém categoria desconhecida sem inventar tipo", () => {
    const snapshot = parseVistaPropertySnapshot({ ...vistaPropertyFixture, Categoria: "Categoria inédita" });
    expect(snapshot.Categoria).toBe("Categoria inédita");
  });

  it("trata campos numéricos vazios como ausentes", () => {
    const snapshot = parseVistaPropertySnapshot({ ...vistaPropertyFixture, Suites: "", AreaPrivativa: null });
    expect(snapshot.Suites).toBeUndefined();
    expect(snapshot.AreaPrivativa).toBeUndefined();
  });
});
