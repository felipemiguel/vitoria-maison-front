import { describe, expect, it } from "vitest";
import { isCollectionIndexable, listingIndexability } from "./indexing";
import { catalogPathForPurpose, parseCatalogParams } from "./catalog-params";

describe("listingIndexability (URLs com filtros)", () => {
  it("indexa a rota base sem parâmetros", () => {
    expect(listingIndexability("/imoveis", {}, 9, 2)).toEqual({ indexable: true, canonicalPath: "/imoveis", reason: "BASE" });
  });

  it("não indexa combinações de filtros e aponta canonical para a rota base", () => {
    const result = listingIndexability("/imoveis", { bairro: "moema", tipo: "FLAT", valorMax: "300000" }, 3, 1);
    expect(result).toEqual({ indexable: false, canonicalPath: "/imoveis", reason: "FILTERED" });
  });

  it("não indexa ordenações", () => {
    expect(listingIndexability("/comprar", { ordem: "price-asc" }, 9).indexable).toBe(false);
  });

  it("ignora parâmetros de rastreamento e mantém canonical limpo", () => {
    expect(listingIndexability("/alugar", { utm_source: "news", gclid: "abc", fbclid: "x" }, 4)).toEqual({ indexable: true, canonicalPath: "/alugar", reason: "BASE" });
  });

  it("paginação válida tem canonical próprio; página 1 explícita volta à base", () => {
    expect(listingIndexability("/imoveis", { pagina: "2" }, 9, 3)).toEqual({ indexable: true, canonicalPath: "/imoveis?pagina=2", reason: "PAGINATED" });
    expect(listingIndexability("/imoveis", { pagina: "1" }, 9, 3).canonicalPath).toBe("/imoveis");
  });

  it("não indexa páginas inválidas, além do total ou resultados vazios", () => {
    expect(listingIndexability("/imoveis", { pagina: "abc" }, 0, 1).reason).toBe("INVALID_PAGE");
    expect(listingIndexability("/imoveis", { pagina: "9" }, 0, 2).reason).toBe("INVALID_PAGE");
    expect(listingIndexability("/imoveis", {}, 0, 1)).toMatchObject({ indexable: false, reason: "EMPTY" });
  });

  it("ignora parâmetros vazios", () => {
    expect(listingIndexability("/imoveis", { bairro: "", tipo: [""] }, 2).indexable).toBe(true);
  });
});

describe("coleções", () => {
  it("coleções vazias não são indexáveis", () => {
    expect(isCollectionIndexable(0)).toBe(false);
    expect(isCollectionIndexable(1)).toBe(true);
  });
});

describe("parseCatalogParams", () => {
  it("descarta valores desconhecidos em vez de quebrar a consulta", () => {
    expect(parseCatalogParams({ finalidade: "DROP TABLE", tipo: "CASTELO", ordem: "x", pagina: "-3", valorMax: "abc", dormitorios: "99" }))
      .toEqual({ purpose: undefined, type: undefined, sort: undefined, neighborhood: undefined, maxPrice: undefined, minArea: undefined, bedrooms: undefined, page: 1 });
  });

  it("converte valores válidos e respeita a finalidade fixa da rota", () => {
    expect(parseCatalogParams({ finalidade: "RENT", tipo: "FLAT", bairro: "Moema", pagina: "2", dormitorios: "2" }, "SALE"))
      .toMatchObject({ purpose: "SALE", type: "FLAT", neighborhood: "Moema", page: 2, bedrooms: 2 });
  });

  it("mapeia finalidade para a rota canônica equivalente", () => {
    expect(catalogPathForPurpose("SALE")).toEqual({ path: "/comprar", keepPurposeParam: false });
    expect(catalogPathForPurpose("RENT")).toEqual({ path: "/alugar", keepPurposeParam: false });
    expect(catalogPathForPurpose("INVESTMENT")).toEqual({ path: "/imoveis", keepPurposeParam: true });
    expect(catalogPathForPurpose(undefined)).toEqual({ path: "/imoveis", keepPurposeParam: false });
  });
});
