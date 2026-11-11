import { describe, expect, it } from "vitest";
import { buildSitemap } from "./sitemap";
import { buildRobots } from "./robots";
import { blockedConfig, indexableConfig } from "./fixtures";
import { MockPropertyRepository } from "@/features/properties/repositories/mock-property-repository";

describe("sitemap", () => {
  const properties = [{ slug: "vista-1", lastModified: new Date("2026-10-01T00:00:00Z") }, { slug: "vista-2" }];
  const collections = [{ slug: "jardins", eligibleItems: 2, lastModified: new Date("2026-09-01T00:00:00Z") }, { slug: "vazia", eligibleItems: 0 }];

  it("fica vazio enquanto a indexação não estiver liberada", () => {
    expect(buildSitemap(blockedConfig(), properties, collections)).toEqual([]);
  });

  it("inclui páginas públicas, coleções com imóveis e imóveis elegíveis", () => {
    const urls = buildSitemap(indexableConfig(), properties, collections).map((entry) => entry.url);
    expect(urls).toContain("https://www.vitoria-maison.test/");
    expect(urls).toContain("https://www.vitoria-maison.test/comprar");
    expect(urls).toContain("https://www.vitoria-maison.test/colecoes/jardins");
    expect(urls).toContain("https://www.vitoria-maison.test/imoveis/vista-1");
    expect(urls).not.toContain("https://www.vitoria-maison.test/colecoes/vazia");
  });

  it("não inclui admin, login, preview, API, filtros, conteúdo demonstrativo ou provisório", () => {
    const urls = buildSitemap(indexableConfig(), properties, collections).map((entry) => entry.url).join("\n");
    expect(urls).not.toMatch(/\/admin|\/login|preview|\/api\/|\?|\/perspectivas|\/termos|\/imovel\//);
  });

  it("usa lastModified somente quando há data real", () => {
    const entries = buildSitemap(indexableConfig(), properties, collections);
    expect(entries.find((entry) => entry.url.endsWith("/imoveis/vista-1"))?.lastModified).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(entries.find((entry) => entry.url.endsWith("/imoveis/vista-2"))).not.toHaveProperty("lastModified");
    expect(entries.find((entry) => entry.url.endsWith("/contato"))).not.toHaveProperty("lastModified");
  });

  it("omite /colecoes quando nenhuma coleção tem imóveis elegíveis", () => {
    const urls = buildSitemap(indexableConfig(), [], [{ slug: "vazia", eligibleItems: 0 }]).map((entry) => entry.url);
    expect(urls).not.toContain("https://www.vitoria-maison.test/colecoes");
  });

  it("conteúdo mock nunca alimenta o sitemap", async () => {
    expect(await new MockPropertyRepository().listSitemapEntries()).toEqual([]);
  });
});

describe("robots.txt", () => {
  it("em produção liberada: permite páginas públicas, bloqueia apenas /api/ e anuncia o sitemap", () => {
    expect(buildRobots(indexableConfig())).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
      sitemap: "https://www.vitoria-maison.test/sitemap.xml",
    });
  });

  it("não bloqueia admin nem filtros (o noindex precisa ser rastreável)", () => {
    const rules = JSON.stringify(buildRobots(indexableConfig()).rules);
    expect(rules).not.toContain("/admin");
    expect(rules).not.toContain("?");
  });

  it("fora de produção: sem sitemap; a página é protegida por noindex", () => {
    expect(buildRobots(blockedConfig())).not.toHaveProperty("sitemap");
  });
});
