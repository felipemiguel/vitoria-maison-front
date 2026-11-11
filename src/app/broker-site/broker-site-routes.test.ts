import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import type { BrokerSiteView } from "@/features/brokers/public-site-service";
import type { PaginatedProperties, Property, PropertyFacets, PropertyFilters } from "@/features/properties/types";
import { propertyFixture } from "@/features/seo/fixtures";

/**
 * Frontend público dos sites de corretores (Fase 6.4B). Host simulado, dados fictícios,
 * imóveis servidos por um repositório falso que respeita o escopo por site (como o SQL real).
 */
const state = vi.hoisted(() => ({
  host: "ana.maison.localhost:3000",
  sites: new Map<string, unknown>(),
  bySite: new Map<string, string[]>(),
  properties: new Map<string, unknown>(),
  ineligible: new Set<string>(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => new Response(null, { headers: { "x-auth-proxy": "1" } })) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: state.host }), cookies: async () => ({ get: () => undefined, set: () => undefined }) }));
vi.mock("@/database/client", () => ({ getDatabase: () => ({}) }));
// next/image valida hosts com a configuração do next.config, que não é carregada no Vitest.
vi.mock("next/image", async () => { const React = await import("react"); return { default: ({ src, alt }: { src: string; alt: string }) => React.createElement("img", { src, alt }) }; });
vi.mock("@/features/brokers/public-site-service", () => ({
  findPublishedSiteBySubdomain: async (_db: unknown, subdomain: string) => { const site = state.sites.get(subdomain) as BrokerSiteView | undefined; return site?.status === "PUBLISHED" ? site : null; },
  findSiteViewById: async () => null,
}));
vi.mock("@/features/brokers/factory", async () => {
  const { BrokerSitePropertyRepository } = await import("@/features/brokers/broker-site-property-repository");
  // Repositório falso: exige brokerSiteId (escopo) e aplica elegibilidade + filtros, como o predicado SQL.
  const fake = {
    async list(filters: PropertyFilters = {}): Promise<PaginatedProperties> {
      const ids = filters.brokerSiteId ? state.bySite.get(filters.brokerSiteId) ?? [] : [];
      let items = ids.filter((id) => !state.ineligible.has(id)).map((id) => state.properties.get(id) as Property);
      if (filters.slug) items = items.filter((p) => p.slug === filters.slug);
      if (filters.purpose) items = items.filter((p) => p.commercial.purpose === filters.purpose);
      if (filters.type) items = items.filter((p) => p.commercial.type === filters.type);
      if (filters.neighborhood) items = items.filter((p) => p.location.neighborhood.toLowerCase() === filters.neighborhood!.toLowerCase());
      const page = filters.page ?? 1, pageSize = filters.pageSize ?? 9;
      return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize, pages: Math.max(1, Math.ceil(items.length / pageSize)) };
    },
    async listFacets(filters: PropertyFilters = {}): Promise<PropertyFacets> {
      const items = (await fake.list({ ...filters, pageSize: 1000 })).items;
      const unique = <T,>(values: T[]) => [...new Set(values)];
      return { purposes: unique(items.map((p) => p.commercial.purpose)), types: unique(items.map((p) => p.commercial.type)), neighborhoods: unique(items.map((p) => p.location.neighborhood)) };
    },
  };
  return { createBrokerServices: () => ({ siteProperties: new BrokerSitePropertyRepository(fake as never) }) };
});

const site = (subdomain: string, overrides: Partial<BrokerSiteView> = {}): BrokerSiteView => ({ siteId: `site-${subdomain}`, subdomain, status: "PUBLISHED", displayName: subdomain === "ana" ? "Ana Fictícia" : "João Fictício", professionalTitle: null, headline: null, subtitle: null, biography: null, profileImageUrl: null, whatsapp: null, emailPublic: null, creci: null, specialties: [], serviceRegions: [], ...overrides });
function addProperty(siteId: string, slug: string, neighborhood = "Moema", purpose: Property["commercial"]["purpose"] = "SALE") {
  const property = propertyFixture({ id: `id-${slug}`, slug, location: { neighborhood, city: "São Paulo", state: "SP" }, commercial: { purpose, type: "FLAT", price: 700000, area: 40, code: slug.toUpperCase() }, editorial: { ...propertyFixture().editorial, title: `Imóvel ${slug}` } });
  state.properties.set(property.id, property);
  state.bySite.set(siteId, [...(state.bySite.get(siteId) ?? []), property.id]);
}
const html = (element: unknown) => renderToStaticMarkup(element as never);
const digest = (promise: Promise<unknown>) => promise.then(() => "NO_THROW", (error: { digest?: string }) => error.digest ?? String(error));
const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

beforeEach(() => {
  for (const [key, value] of Object.entries({ NODE_ENV: "development", BROKER_SITES_ENABLED: "true", BROKER_SITES_BASE_DOMAIN: "maison.localhost", NEXT_PUBLIC_SITE_URL: "", SITE_INDEXING_ENABLED: "", BROKER_SITES_INDEXING_ENABLED: "", BROKER_LEADS_ENABLED: "true" })) vi.stubEnv(key, value);
  state.sites = new Map<string, unknown>([
    ["ana", site("ana", { headline: "Flats e apartamentos em Moema", whatsapp: "11988887777", emailPublic: "ana@corretora.test", specialties: ["Flats"], serviceRegions: ["Moema"], creci: "123456-F/SP" })],
    ["joao", site("joao")],
    ["suspenso", site("suspenso", { status: "SUSPENDED" })],
    ["rascunho", site("rascunho", { status: "DRAFT" })],
  ]);
  state.bySite = new Map(); state.properties = new Map(); state.ineligible = new Set();
  for (let index = 1; index <= 11; index += 1) addProperty("site-ana", `ana-${index}`, index % 2 ? "Moema" : "Itaim Bibi", index === 3 ? "RENT" : "SALE");
  addProperty("site-joao", "joao-exclusivo", "Pinheiros");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("home", () => {
  it("cada subdomínio renderiza o próprio corretor e somente a própria seleção", async () => {
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/page");
    const ana = html(await page.default(params({ subdomain: "ana" })));
    expect(ana).toContain("Flats e apartamentos em Moema");
    expect(ana).toContain("Minha seleção de imóveis");
    expect(ana).toContain("Imóvel ana-1");
    expect(ana).not.toContain("joao-exclusivo");
    expect(ana).not.toContain("João Fictício");
    expect((ana.match(/href="\/imoveis\/ana-/g) ?? []).length).toBe(6);
    state.host = "joao.maison.localhost:3000";
    const joao = html(await page.default(params({ subdomain: "joao" })));
    expect(joao).toContain("João Fictício");
    expect(joao).toContain("Imóvel joao-exclusivo");
    expect(joao).not.toContain("ana-1");
  });

  it("perfil incompleto: sem inventar especialidades, bio ou fotos; seleção vazia com estado editorial", async () => {
    state.host = "joao.maison.localhost:3000";
    state.bySite.set("site-joao", []);
    const page = await import("./[subdomain]/page");
    const joao = html(await page.default(params({ subdomain: "joao" })));
    expect(joao).toContain("Estou preparando a minha seleção.");
    expect(joao).toContain("Fale comigo");
    expect(joao).not.toMatch(/Fale com João|Conversar com João/);
    expect(joao).not.toContain("Especialidades");
    expect(joao).not.toContain("Regiões de atuação");
    expect(joao).not.toContain("CRECI");
    expect(joao).not.toContain("wa.me");
    expect(joao).toContain('aria-label="Iniciais de João Fictício"');
    expect(joao).not.toMatch(/<img[^>]+alt="Foto de João/);
  });

  it("contatos: WhatsApp e e-mail só quando configurados; formulário avisa que vai para a equipe Maison", async () => {
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/page");
    const ana = html(await page.default(params({ subdomain: "ana" })));
    expect(ana).toContain("https://wa.me/5511988887777?text=");
    expect(ana).toContain("mailto:ana@corretora.test");
    expect(ana).toContain("Vamos encontrar o imóvel ideal?");
    expect(ana).toContain("recebidas pela equipe Vitória Maison");
    expect(ana).toContain("CRECI");
  });

  it("formulários desligados (BROKER_LEADS_ENABLED=false): aviso claro, sem formulário parcial", async () => {
    vi.stubEnv("BROKER_LEADS_ENABLED", "false");
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/page");
    const ana = html(await page.default(params({ subdomain: "ana" })));
    expect(ana).toContain("Formulário em preparação");
    expect(ana).toContain("fale comigo pelo WhatsApp");
    expect(ana).not.toContain('name="submissionKey"');
    expect(ana).toContain("https://wa.me/5511988887777?text=");
  });

  it("filtros da home só oferecem valores existentes na seleção do site", async () => {
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/page");
    const ana = html(await page.default(params({ subdomain: "ana" })));
    expect(ana).toContain('<option value="Itaim Bibi">');
    expect(ana).not.toContain('<option value="Pinheiros">');
    expect(ana).toContain('action="/imoveis"');
    expect(ana).not.toContain('<option value="INVESTMENT">');
  });
});

describe("catálogo exclusivo", () => {
  it("lista apenas a seleção do site, com paginação", async () => {
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/imoveis/page");
    const first = html(await page.default({ ...params({ subdomain: "ana" }), searchParams: Promise.resolve({}) }));
    expect(first).toContain("11 imóveis encontrados");
    expect(first).not.toContain("joao-exclusivo");
    expect(first).toContain('href="/imoveis?pagina=2"');
    const second = html(await page.default({ ...params({ subdomain: "ana" }), searchParams: Promise.resolve({ pagina: "2" }) }));
    expect((second.match(/href="\/imoveis\/ana-/g) ?? []).length).toBe(2);
  });

  it("busca e filtros restringem a seleção; nunca ampliam para outros imóveis", async () => {
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/imoveis/page");
    const moema = html(await page.default({ ...params({ subdomain: "ana" }), searchParams: Promise.resolve({ bairro: "Moema" }) }));
    expect(moema).toContain("6 imóveis encontrados");
    const pinheiros = html(await page.default({ ...params({ subdomain: "ana" }), searchParams: Promise.resolve({ bairro: "Pinheiros" }) }));
    expect(pinheiros).toContain("0 imóveis encontrados");
    expect(pinheiros).not.toContain("joao-exclusivo");
    const rent = html(await page.default({ ...params({ subdomain: "ana" }), searchParams: Promise.resolve({ finalidade: "RENT" }) }));
    expect(rent).toContain("1 imóvel encontrado");
    expect(rent).toContain("Limpar filtros");
  });

  it("catálogo não é indexável (subconjunto do catálogo Maison)", async () => {
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/imoveis/page");
    const metadata = await page.generateMetadata({ ...params({ subdomain: "ana" }), searchParams: Promise.resolve({}) });
    expect(metadata.robots).toMatchObject({ index: false });
    expect(metadata.alternates?.canonical).toBe("http://ana.maison.localhost:3000/imoveis");
  });
});

describe("detalhe de imóvel", () => {
  it("imóvel do site: dados comerciais preservados, contato do corretor e relacionados do mesmo site", async () => {
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/imoveis/[slug]/page");
    const detail = html(await page.default(params({ subdomain: "ana", slug: "ana-1" })));
    expect(detail).toContain("Imóvel ana-1");
    expect(detail).toContain("Código do imóvel: ANA-1");
    expect(detail).toContain("Voltar à seleção");
    expect(detail).toContain(encodeURIComponent("Tenho interesse no imóvel ANA-1 divulgado em seu site: "));
    expect(detail).toContain(encodeURIComponent("http://ana.maison.localhost:3000/imoveis/ana-1"));
    expect(detail).toContain("Outros imóveis da minha seleção");
    expect(detail).not.toContain("joao-exclusivo");
  });

  it("imóvel de outro corretor pela URL → 404", async () => {
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/imoveis/[slug]/page");
    expect(await digest(page.default(params({ subdomain: "ana", slug: "joao-exclusivo" })))).toContain("404");
  });

  it("imóvel despublicado/inelegível na Maison → 404 e some do catálogo", async () => {
    state.ineligible.add("id-ana-1");
    state.host = "ana.maison.localhost:3000";
    const detail = await import("./[subdomain]/imoveis/[slug]/page");
    expect(await digest(detail.default(params({ subdomain: "ana", slug: "ana-1" })))).toContain("404");
    const catalog = await import("./[subdomain]/imoveis/page");
    const listing = html(await catalog.default({ ...params({ subdomain: "ana" }), searchParams: Promise.resolve({}) }));
    expect(listing).toContain("10 imóveis encontrados");
    expect(listing).not.toContain('href="/imoveis/ana-1"');
  });

  it("canonical aponta para a URL principal do imóvel na Maison", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vitoria-maison.test");
    state.host = "ana.maison.localhost:3000";
    const page = await import("./[subdomain]/imoveis/[slug]/page");
    const metadata = await page.generateMetadata(params({ subdomain: "ana", slug: "ana-2" }));
    expect(metadata.alternates?.canonical).toBe("https://www.vitoria-maison.test/imoveis/ana-2");
  });
});

describe("sites não publicados e inexistentes", () => {
  it("suspenso, rascunho e inexistente → 404 no layout e nas páginas", async () => {
    const layout = await import("./[subdomain]/layout");
    const home = await import("./[subdomain]/page");
    for (const subdomain of ["suspenso", "rascunho", "inexistente"]) {
      state.host = `${subdomain}.maison.localhost:3000`;
      expect(await digest(layout.default({ children: null, ...params({ subdomain }) }))).toContain("404");
      expect(await digest(home.default(params({ subdomain })))).toContain("404");
    }
  });
});

describe("metadata, SEO e cache por site", () => {
  it("metadata individual sem vazar entre hostnames", async () => {
    const page = await import("./[subdomain]/page");
    state.host = "ana.maison.localhost:3000";
    const ana = await page.generateMetadata(params({ subdomain: "ana" }));
    state.host = "joao.maison.localhost:3000";
    const joao = await page.generateMetadata(params({ subdomain: "joao" }));
    expect(ana.title).toEqual({ absolute: "Ana Fictícia | Vitória Maison" });
    expect(ana.alternates?.canonical).toBe("http://ana.maison.localhost:3000/");
    expect(joao.title).toEqual({ absolute: "João Fictício | Vitória Maison" });
    expect(JSON.stringify(joao)).not.toContain("Ana");
  });

  it("home publicada só é indexável com indexação global + decisão explícita para sites de corretores", async () => {
    const page = await import("./[subdomain]/page");
    state.host = "ana.maison.localhost:3000";
    expect((await page.generateMetadata(params({ subdomain: "ana" }))).robots).toMatchObject({ index: false });
    for (const [key, value] of Object.entries({ NODE_ENV: "production", SITE_INDEXING_ENABLED: "true", NEXT_PUBLIC_SITE_URL: "https://www.vitoria-maison.test", PROPERTY_DATA_SOURCE: "database", BROKER_SITES_BASE_DOMAIN: "vitoria-maison.test" })) vi.stubEnv(key, value);
    state.host = "ana.vitoria-maison.test";
    expect((await page.generateMetadata(params({ subdomain: "ana" }))).robots).toMatchObject({ index: false });
    vi.stubEnv("BROKER_SITES_INDEXING_ENABLED", "true");
    const indexable = await page.generateMetadata(params({ subdomain: "ana" }));
    expect(indexable.robots).toMatchObject({ index: true });
    expect(indexable.alternates?.canonical).toBe("https://ana.vitoria-maison.test/");
  });

  it("robots.txt do site segue a mesma política", async () => {
    const route = await import("./[subdomain]/robots.txt/route");
    state.host = "ana.maison.localhost:3000";
    expect(await (await route.GET(new Request("http://x"), params({ subdomain: "ana" }))).text()).toContain("Disallow: /");
    state.host = "suspenso.maison.localhost:3000";
    expect(await (await route.GET(new Request("http://x"), params({ subdomain: "suspenso" }))).text()).toContain("Disallow: /");
  });
});

describe("componentes", () => {
  it("header com menu móvel acessível e sem links administrativos", async () => {
    const { BrokerHeader } = await import("@/components/broker-site/broker-header");
    const { PUBLIC_LINKS } = await import("@/components/broker-site/links");
    const markup = html(createElement(BrokerHeader, { name: "Ana Fictícia", links: PUBLIC_LINKS }));
    expect(markup).toContain('aria-label="Abrir menu"');
    for (const href of ["/", "/imoveis", "/#sobre", "/#contato"]) expect(markup).toContain(`href="${href}"`);
    expect(markup).not.toContain("/admin");
  });

  it("imagem ausente: retrato neutro com iniciais, nunca foto de outra pessoa", async () => {
    const { BrokerPortrait } = await import("@/components/broker-site/broker-portrait");
    const markup = html(createElement(BrokerPortrait, { name: "Ana Souza", url: null, sizes: "100vw" }));
    expect(markup).toContain(">AS<");
    expect(markup).not.toContain("<img");
  });

  it("WhatsApp: número real, mensagem com código e link, sem dados pessoais", async () => {
    const { brokerWhatsappLink } = await import("@/features/brokers/contact");
    const link = brokerWhatsappLink("(11) 98888-7777", { brokerName: "Ana Souza", propertyCode: "123", propertyUrl: "https://ana.x.test/imoveis/a" })!;
    expect(link.startsWith("https://wa.me/5511988887777?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("Olá! Tenho interesse no imóvel 123 divulgado em seu site: https://ana.x.test/imoveis/a.");
    // Código fora do padrão e URL não-HTTP não entram na mensagem.
    const unsafe = decodeURIComponent(brokerWhatsappLink("(11) 98888-7777", { brokerName: "Ana", propertyCode: "<x>", propertyUrl: "javascript:alert(1)" })!);
    expect(unsafe).not.toContain("javascript");
    expect(unsafe).not.toContain("<x>");
    expect(brokerWhatsappLink(null, { brokerName: "Ana" })).toBeNull();
    expect(brokerWhatsappLink("123", { brokerName: "Ana" })).toBeNull();
  });
});

describe("leads e proxy", () => {
  it("origem do lead decidida pelo Host: institucional/externo → Maison; host inválido, reservado ou recurso desligado → recusado (sem consultar o banco)", async () => {
    const { resolveLeadOrigin, LeadOriginError, BROKER_LEADS_DISABLED } = await import("@/features/brokers/broker-lead-submission-service");
    const config = { enabled: true, baseDomain: "maison.localhost", institutionalHosts: new Set(["localhost", "maison.localhost"]) };
    const db = new Proxy({}, { get() { throw new Error("banco não deveria ser consultado"); } }) as never;
    expect(await resolveLeadOrigin(db, "localhost:3000", "/imoveis/ana-1", config, true)).toEqual({ source: "MAISON_SITE", hostname: "localhost", path: "/imoveis/ana-1" });
    // Preview/host externo nunca vira corretor; prefixo interno vindo do navegador é descartado.
    expect(await resolveLeadOrigin(db, "preview.vercel.app", "/corretor/ana/imoveis/x", config, true)).toEqual({ source: "MAISON_SITE", hostname: "preview.vercel.app", path: "/" });
    await expect(resolveLeadOrigin(db, "a.b.maison.localhost", "/", config, true)).rejects.toBeInstanceOf(LeadOriginError);
    await expect(resolveLeadOrigin(db, "admin.maison.localhost", "/", config, true)).rejects.toBeInstanceOf(LeadOriginError);
    await expect(resolveLeadOrigin(db, "ana.maison.localhost", "/", { ...config, enabled: false }, true)).rejects.toBeInstanceOf(LeadOriginError);
    await expect(resolveLeadOrigin(db, "ana.maison.localhost", "/", config, false)).rejects.toThrow(BROKER_LEADS_DISABLED);
  });

  it("proxy: rewrite por host, sem noindex global; arquivos públicos passam; caminho interno e painel bloqueados", async () => {
    const { proxy } = await import("@/proxy");
    const call = (host: string, path: string) => proxy(new NextRequest(`http://${host}${path}`, { headers: { host } }), {} as never);
    const rewrite = await call("ana.maison.localhost:3000", "/imoveis");
    expect(rewrite?.headers.get("x-middleware-rewrite")).toContain("/broker-site/ana/imoveis");
    expect(rewrite?.headers.get("x-robots-tag")).toBeNull();
    expect((await call("ana.maison.localhost:3000", "/images/brand/vitoria-maison-logo-horizontal.png"))?.headers.get("x-middleware-next")).toBe("1");
    expect((await call("ana.maison.localhost:3000", "/media/00000000-0000-4000-8000-000000000001"))?.headers.get("x-middleware-next")).toBe("1");
    expect((await call("localhost:3000", "/broker-site/ana"))?.status).toBe(404);
    expect((await call("ana.maison.localhost:3000", "/admin"))?.status).toBe(404);
    expect((await call("localhost:3000", "/imoveis"))?.headers.get("x-middleware-next")).toBe("1");
    expect((await call("localhost:3000", "/admin/login"))?.headers.get("x-auth-proxy")).toBe("1");
  });
});
