import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { propertyFixture, productionEnv } from "@/features/seo/fixtures";
import type { Property } from "@/features/properties/types";

const repo = vi.hoisted(() => ({
  bySlug: new Map<string, Property>(),
  byCode: new Map<string, string>(),
  list: vi.fn(),
  countEligibleByCollection: vi.fn(async () => new Map<string, number>()),
  collectionItems: new Map<string, Property[]>(),
}));
const collectionsState = vi.hoisted(() => ({ items: [] as { slug: string; name: string; description: string | null; coverImageUrl: string | null; sortOrder: number }[], redirects: new Map<string, string>() }));
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/properties/services/property-service", () => ({
  propertyRepository: {
    findSlugByExternalCode: async (code: string) => repo.byCode.get(code) ?? null,
    list: repo.list,
    countEligibleByCollection: repo.countEligibleByCollection,
  },
  getPublishedPropertyBySlug: async (slug: string) => repo.bySlug.get(slug) ?? null,
  getPropertiesByCollection: async (slug: string) => repo.collectionItems.get(slug) ?? [],
}));
vi.mock("@/features/collections/public-collection-service", () => ({
  listPublicCollections: async () => collectionsState.items,
  findPublicCollection: async (slug: string) => collectionsState.items.find((item) => item.slug === slug) ?? null,
  findCollectionRedirect: async (slug: string) => collectionsState.redirects.get(slug) ?? null,
}));

function digestOf(fn: () => Promise<unknown>) {
  return fn().then(() => "NO_THROW", (error: { digest?: string }) => error.digest ?? String(error));
}

beforeEach(() => {
  for (const [key, value] of Object.entries(productionEnv)) vi.stubEnv(key, value);
  repo.bySlug.clear(); repo.byCode.clear(); repo.collectionItems.clear();
  collectionsState.items = []; collectionsState.redirects.clear();
  repo.list.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("/imoveis/[slug]", () => {
  it("imóvel publicado e elegível: metadata indexável com canonical e foto real", async () => {
    const property = propertyFixture();
    repo.bySlug.set(property.slug, property);
    const { generateMetadata } = await import("./(public)/imoveis/[slug]/page");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: property.slug }) });
    expect(metadata.title).toBe("Flat à venda em Moema, 48 m²");
    expect(metadata.alternates?.canonical).toBe("https://www.vitoria-maison.test/imoveis/vista-12345678");
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(JSON.stringify(metadata.openGraph?.images)).toContain("https://cdn.fotos.test/vitoria/1.jpg");
  });

  it("imóvel não publicado, rascunho ou indisponível (inelegível): noindex e 404", async () => {
    const page = await import("./(public)/imoveis/[slug]/page");
    const metadata = await page.generateMetadata({ params: Promise.resolve({ slug: "vista-rascunho" }) });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(await digestOf(() => page.default({ params: Promise.resolve({ slug: "vista-rascunho" }) }))).toContain("404");
  });
});

describe("catálogo com filtros", () => {
  const result = (count: number) => ({ items: Array.from({ length: count }, () => propertyFixture()), total: count, page: 1, pageSize: 9, pages: 1 });

  it("rota base indexável; filtros e ordenação noindex com canonical na base", async () => {
    repo.list.mockResolvedValue(result(3));
    const { generateMetadata } = await import("./(public)/comprar/page");
    expect((await generateMetadata({ searchParams: Promise.resolve({}) })).robots).toMatchObject({ index: true });
    const filtered = await generateMetadata({ searchParams: Promise.resolve({ bairro: "moema", ordem: "price-asc" }) });
    expect(filtered.robots).toMatchObject({ index: false, follow: true });
    expect(filtered.alternates?.canonical).toBe("https://www.vitoria-maison.test/comprar");
    expect(repo.list).toHaveBeenLastCalledWith(expect.objectContaining({ purpose: "SALE", neighborhood: "moema", sort: "price-asc" }));
  });

  it("resultado vazio não é indexado", async () => {
    repo.list.mockResolvedValue(result(0));
    const { generateMetadata } = await import("./(public)/imoveis/page");
    expect((await generateMetadata({ searchParams: Promise.resolve({}) })).robots).toMatchObject({ index: false });
  });
});

describe("/colecoes/[slug]", () => {
  it("coleção com imóveis é indexável; coleção vazia não", async () => {
    collectionsState.items = [{ slug: "jardins", name: "Jardins", description: "Arquitetura e vida a pé.", coverImageUrl: null, sortOrder: 1 }, { slug: "vazia", name: "Vazia", description: null, coverImageUrl: null, sortOrder: 2 }];
    repo.collectionItems.set("jardins", [propertyFixture()]);
    const { generateMetadata } = await import("./(public)/colecoes/[slug]/page");
    const full = await generateMetadata({ params: Promise.resolve({ slug: "jardins" }) });
    expect(full.robots).toMatchObject({ index: true });
    expect(full.title).toBe("Coleção Jardins");
    expect(JSON.stringify(full.openGraph?.images)).toContain("https://cdn.fotos.test/vitoria/1.jpg");
    expect((await generateMetadata({ params: Promise.resolve({ slug: "vazia" }) })).robots).toMatchObject({ index: false });
  });

  it("slug antigo redireciona permanentemente para o slug atual", async () => {
    collectionsState.redirects.set("jardins-antigo", "jardins");
    const page = await import("./(public)/colecoes/[slug]/page");
    expect(await digestOf(() => page.default({ params: Promise.resolve({ slug: "jardins-antigo" }) }))).toMatch(/NEXT_REDIRECT;.*\/colecoes\/jardins;308/);
    expect(await digestOf(() => page.default({ params: Promise.resolve({ slug: "inexistente" }) }))).toContain("404");
  });
});

describe("/imovel/[slug] (legado Vitória Flats)", () => {
  it("redireciona somente imóveis selecionados e elegíveis; os demais respondem 404 (nunca para a home)", async () => {
    repo.byCode.set("16786218", "vista-16786218");
    const page = await import("./(public)/imovel/[slug]/page");
    expect(await digestOf(() => page.default({ params: Promise.resolve({ slug: "flat-campo-belo-sao-paulo-sp-1-quartos-26m2-16786218" }) }))).toMatch(/NEXT_REDIRECT;.*\/imoveis\/vista-16786218;308/);
    expect(await digestOf(() => page.default({ params: Promise.resolve({ slug: "studio-alto-do-ipiranga-sao-paulo-sp-1-quartos-17835908" }) }))).toContain("404");
  });
});

describe("previews e painel", () => {
  it("layout administrativo é sempre noindex, inclusive a prévia autenticada", async () => {
    const { metadata } = await import("./admin/layout");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("indexação global bloqueada em preview, mesmo com a flag ligada", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { generateMetadata } = await import("./layout");
    expect(generateMetadata().robots).toMatchObject({ index: false, follow: false });
  });
});

describe("revalidação após publicação e despublicação", () => {
  it("invalida home, catálogos, detalhes, coleções e sitemap", async () => {
    const { revalidatePublicCatalog } = await import("@/features/admin/revalidation");
    revalidatePath.mockClear();
    await revalidatePublicCatalog();
    const paths = revalidatePath.mock.calls.map((call) => call[0]);
    for (const path of ["/", "/imoveis", "/comprar", "/alugar", "/imoveis/[slug]", "/colecoes", "/colecoes/[slug]", "/sitemap.xml"]) expect(paths).toContain(path);
  });
});

describe("integridade dos links internos", () => {
  it("links do header e do footer apontam para rotas existentes", async () => {
    const { NAV_LINKS } = await import("@/components/layout/header");
    const { FOOTER_LINKS } = await import("@/components/layout/footer");
    for (const [, href] of [...NAV_LINKS, ...FOOTER_LINKS, ["", "/contato"], ["", "/privacidade"], ["", "/termos"]]) {
      expect(existsSync(join(process.cwd(), "src/app/(public)", href, "page.tsx")), href).toBe(true);
    }
  });
});
