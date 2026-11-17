import { describe, expect, it } from "vitest";
import { contentSchema, defaultContent, emptyBlock, parseStoredContent, toRichChunks } from "./blocks";
import type { Property } from "@/features/properties/types";

const property: Property = {
  id: "p1", slug: "vista-123", commercial: { purpose: "SALE", type: "APARTMENT", price: 900000, area: 60, bedrooms: 2, code: "123" },
  location: { neighborhood: "Moema", city: "São Paulo", state: "SP" },
  editorial: { title: "Apartamento fictício em Moema", description: "Descrição fictícia.", images: [{ url: "https://fotos.teste.local/1.jpg", alt: "Sala" }], features: ["Varanda", "Piscina"] },
  curation: { published: true, featured: false, collections: [] },
};
let counter = 0;
const ids = () => `blk${(counter += 1).toString().padStart(3, "0")}`;

describe("conteúdo de landing page", () => {
  it("template inicial é válido, começa pelo topo e usa os dados do imóvel", () => {
    const content = defaultContent(property, ids);
    expect(contentSchema.parse(content)).toEqual(content);
    expect(content.blocks[0]).toMatchObject({ type: "hero", title: "Apartamento fictício em Moema", eyebrow: "Moema · São Paulo" });
    expect(content.blocks.find((block) => block.type === "highlights")).toMatchObject({ items: [{ title: "Varanda" }, { title: "Piscina" }] });
    expect(content.blocks.filter((block) => !block.enabled).map((block) => block.type)).toEqual(["faq", "conditions"]);
  });

  it("topo: no máximo um e sempre o primeiro; IDs únicos", () => {
    const hero = emptyBlock("hero", "hero01"); const text = emptyBlock("text", "text01");
    expect(() => contentSchema.parse({ blocks: [text, hero] })).toThrow(/primeiro/);
    expect(() => contentSchema.parse({ blocks: [hero, { ...emptyBlock("hero", "hero02") }] })).toThrow(/um bloco de topo/);
    expect(() => contentSchema.parse({ blocks: [hero, text, { ...text }] })).toThrow(/duplicados/);
  });

  it("recusa tipos desconhecidos, campos longos e excesso de blocos", () => {
    expect(() => contentSchema.parse({ blocks: [{ id: "abcd1", enabled: true, type: "html", html: "<script>" }] })).toThrow();
    expect(() => contentSchema.parse({ blocks: [{ ...emptyBlock("hero", "hero01"), title: "x".repeat(121) }] })).toThrow(/120/);
    expect(() => contentSchema.parse({ blocks: Array.from({ length: 21 }, (_, index) => emptyBlock("text", `text${index}x`)) })).toThrow(/20 blocos/);
  });

  it("descarta itens vazios de diferenciais e FAQ", () => {
    const parsed = contentSchema.parse({ blocks: [{ ...emptyBlock("highlights", "high01"), items: [{ title: "", text: "" }, { title: "Vista", text: "" }] }, { ...emptyBlock("faq", "faq001"), items: [{ question: "Aceita pet?", answer: "" }, { question: "Tem vaga?", answer: "Sim." }] }] });
    expect(parsed.blocks[0]).toMatchObject({ items: [{ title: "Vista" }] });
    expect(parsed.blocks[1]).toMatchObject({ items: [{ question: "Tem vaga?" }] });
  });

  it("conteúdo inválido no banco vira página vazia, sem erro", () => {
    expect(parseStoredContent({ schemaVersion: 99, blocks: "x" })).toEqual({ schemaVersion: 1, blocks: [] });
    expect(parseStoredContent(null).blocks).toEqual([]);
  });

  it("texto puro: parágrafos e listas, HTML nunca é interpretado", () => {
    expect(toRichChunks("Primeiro\nparágrafo.\n\n- um\n- dois\n\n<b>oi</b>")).toEqual([
      { kind: "paragraph", text: "Primeiro parágrafo." }, { kind: "list", items: ["um", "dois"] }, { kind: "paragraph", text: "<b>oi</b>" },
    ]);
  });
});
