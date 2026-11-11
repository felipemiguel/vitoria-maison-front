import { describe, expect, it } from "vitest";
import { mapVistaPropertyList } from "./vista-property-list-mapper";

const record = { Codigo: "31", Categoria: "Apartamento", Cidade: "São Paulo", Bairro: "Centro", ValorVenda: "1.500.000", ValorLocacao: "", Dormitorios: "3", Suites: "1", Vagas: "2", AreaTotal: "180", AreaPrivativa: "140", FotoDestaque: "https://cdn.example.test/31.jpg" };

describe("VistaPropertyListMapper", () => {
  it("converte strings numéricas, foto HTTPS e totalização", () => {
    const result = mapVistaPropertyList({ 0: record, total: 42, paginas: 3, pagina: 1, quantidade: 20 }, { page: 1, pageSize: 20, allowedImageHostname: "cdn.example.test" });
    expect(result.items[0]).toMatchObject({ code: "31", salePrice: 1_500_000, bedrooms: 3, coverImageUrl: "https://cdn.example.test/31.jpg" });
    expect(result).toMatchObject({ total: 42, pages: 3, page: 1, pageSize: 20 });
  });

  it("não mistura URL insegura ou de host diferente", () => {
    const result = mapVistaPropertyList([{ ...record, FotoDestaque: "http://other.test/31.jpg" }], { page: 1, pageSize: 20, allowedImageHostname: "cdn.example.test" });
    expect(result.items[0]?.coverImageUrl).toBeNull();
  });

  it("aceita resposta vazia", () => {
    expect(mapVistaPropertyList([], { page: 1, pageSize: 20, allowedImageHostname: "cdn.example.test" }).items).toEqual([]);
  });
});
