import { describe, expect, it } from "vitest";
import { propertyFactsSentence, propertySeoDescription, propertySeoTitle } from "./property-seo";
import { propertyFixture } from "./fixtures";

describe("metadata de imóvel", () => {
  it("monta título com categoria, finalidade, bairro e área", () => {
    expect(propertySeoTitle(propertyFixture())).toBe("Flat à venda em Moema, 48 m²");
    expect(propertySeoTitle(propertyFixture({ location: { neighborhood: "Jardins", city: "São Paulo", state: "SP" }, commercial: { purpose: "RENT", type: "APARTMENT", price: 9000, area: 120, code: "1" } })))
      .toBe("Apartamento para alugar nos Jardins, 120 m²");
  });

  it("mantém o título curto o suficiente para o template da marca", () => {
    expect(`${propertySeoTitle(propertyFixture())} | Vitória Maison`.length).toBeLessThanOrEqual(65);
  });

  it("usa somente atributos existentes, sem inventar características", () => {
    const sentence = propertyFactsSentence(propertyFixture());
    expect(sentence).toContain("48 m² de área privativa");
    expect(sentence).toContain("1 dormitório");
    expect(sentence).not.toMatch(/suíte|vaga|metrô|vista|rentabilidade|condomínio/i);
  });

  it("omite preço quando ausente", () => {
    const property = propertyFixture({ commercial: { purpose: "SALE", type: "FLAT", price: 0, area: 48, code: "1" } });
    expect(propertyFactsSentence(property)).not.toMatch(/R\$|Valor/);
  });

  it("prefere a descrição editorial Maison; não reutiliza texto bruto do Vista", () => {
    const editorial = propertyFixture({ editorial: { ...propertyFixture().editorial, description: "Texto editorial aprovado pela equipe Maison, com informações confirmadas sobre o imóvel.", descriptionSource: "editorial" } });
    expect(propertySeoDescription(editorial)).toContain("Texto editorial aprovado");
    const source = propertySeoDescription(propertyFixture());
    expect(source).not.toContain("Texto de origem");
    expect(source).toContain("Código 12345678");
    expect(source.length).toBeLessThanOrEqual(160);
  });

  it("gera descrições diferentes para imóveis diferentes", () => {
    const a = propertySeoDescription(propertyFixture());
    const b = propertySeoDescription(propertyFixture({ commercial: { ...propertyFixture().commercial, area: 52, code: "87654321" } }));
    expect(a).not.toBe(b);
  });
});
