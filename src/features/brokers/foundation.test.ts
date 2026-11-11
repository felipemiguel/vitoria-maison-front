import { describe, expect, it } from "vitest";
import { getBrokerSitesConfig } from "./config";
import { brokerSiteUrl, normalizeHost, resolveHost } from "./hosts";
import { routeRequest } from "./routing";
import { normalizeSubdomainCandidate, subdomainCandidates, validateSubdomain, RESERVED_SUBDOMAINS } from "./subdomain-rules";
import { canTransition, isPubliclyVisible } from "./status";
import { canAccessBrokerSite } from "./broker-site-service";

const prod = getBrokerSitesConfig({ NODE_ENV: "production", BROKER_SITES_ENABLED: "true", BROKER_SITES_BASE_DOMAIN: "vitoriamaison.com.br", NEXT_PUBLIC_SITE_URL: "https://vitoriamaison.com.br" });
const dev = getBrokerSitesConfig({ NODE_ENV: "development", BROKER_SITES_ENABLED: "true", BROKER_SITES_BASE_DOMAIN: "maison.localhost" });

describe("configuração de domínios", () => {
  it("desligado por padrão", () => {
    expect(getBrokerSitesConfig({}).enabled).toBe(false);
    expect(getBrokerSitesConfig({ BROKER_SITES_BASE_DOMAIN: "vitoriamaison.com.br" }).enabled).toBe(false);
  });
  it("não aceita domínio de desenvolvimento em produção nem domínio inválido", () => {
    const config = getBrokerSitesConfig({ NODE_ENV: "production", BROKER_SITES_ENABLED: "true", BROKER_SITES_BASE_DOMAIN: "maison.lvh.me" });
    expect(config.enabled).toBe(false);
    expect(config.problems.join()).toMatch(/desenvolvimento/);
    expect(getBrokerSitesConfig({ BROKER_SITES_ENABLED: "true", BROKER_SITES_BASE_DOMAIN: "https://x.com/" }).enabled).toBe(false);
  });
  it("produção usa HTTPS sem porta; desenvolvimento usa HTTP com porta", () => {
    expect(brokerSiteUrl("ana", prod)).toBe("https://ana.vitoriamaison.com.br/");
    expect(brokerSiteUrl("ana", dev)).toBe("http://ana.maison.localhost:3000/");
  });
});

describe("resolução por hostname", () => {
  it("resolve subdomínio de corretor, com porta, maiúsculas e ponto final", () => {
    expect(resolveHost("ana.vitoriamaison.com.br", prod)).toEqual({ kind: "broker", subdomain: "ana" });
    expect(resolveHost("ANA.VitoriaMaison.com.br.", prod)).toEqual({ kind: "broker", subdomain: "ana" });
    expect(resolveHost("joao-silva.maison.localhost:3000", dev)).toEqual({ kind: "broker", subdomain: "joao-silva" });
  });
  it("domínio institucional, www e hosts externos (preview) nunca viram corretor", () => {
    for (const host of ["vitoriamaison.com.br", "www.vitoriamaison.com.br", "localhost:3000", "127.0.0.1", "projeto-git-main.vercel.app", "ana.vitoriamaison.com.br.evil.com", "evil-vitoriamaison.com.br"]) expect(resolveHost(host, prod)).toEqual({ kind: "institutional" });
  });
  it("rejeita hostnames inválidos, multinível e reservados", () => {
    expect(resolveHost("a.b.vitoriamaison.com.br", prod).kind).toBe("invalid");
    expect(resolveHost("an_a.vitoriamaison.com.br", prod).kind).toBe("invalid");
    expect(resolveHost("<script>.vitoriamaison.com.br", prod).kind).toBe("invalid");
    expect(resolveHost("", prod).kind).toBe("invalid");
    expect(resolveHost("admin.vitoriamaison.com.br", prod).kind).toBe("reserved");
    expect(resolveHost("api.vitoriamaison.com.br", prod).kind).toBe("reserved");
    expect(normalizeHost("Exemplo.COM:8080")).toBe("exemplo.com");
  });
});

describe("roteamento do proxy", () => {
  it("rotas institucionais seguem inalteradas", () => {
    for (const path of ["/", "/imoveis", "/admin", "/admin/usuarios", "/api/auth/csrf", "/sitemap.xml"]) expect(routeRequest("vitoriamaison.com.br", path, prod)).toEqual({ type: "next" });
  });
  it("subdomínio de corretor é reescrito para a rota interna com o subdomínio resolvido", () => {
    expect(routeRequest("ana.vitoriamaison.com.br", "/", prod)).toEqual({ type: "rewrite", subdomain: "ana", pathname: "/broker-site/ana" });
    expect(routeRequest("ana.vitoriamaison.com.br", "/robots.txt", prod)).toMatchObject({ pathname: "/broker-site/ana/robots.txt" });
  });
  it("o caminho interno nunca é acessível diretamente, em nenhum host (sem spoofing)", () => {
    expect(routeRequest("vitoriamaison.com.br", "/broker-site/ana", prod)).toEqual({ type: "notFound" });
    expect(routeRequest("joao.vitoriamaison.com.br", "/broker-site/ana", prod)).toEqual({ type: "notFound" });
  });
  it("painel, APIs e metadados institucionais não respondem em hosts de corretores", () => {
    for (const path of ["/admin", "/admin/login", "/api/auth/csrf", "/sitemap.xml", "/og/marca.png"]) expect(routeRequest("ana.vitoriamaison.com.br", path, prod)).toEqual({ type: "notFound" });
  });
  it("reservados, inválidos e recurso desligado respondem 404", () => {
    expect(routeRequest("admin.vitoriamaison.com.br", "/", prod)).toEqual({ type: "notFound" });
    expect(routeRequest("a.b.vitoriamaison.com.br", "/", prod)).toEqual({ type: "notFound" });
    const off = getBrokerSitesConfig({ NODE_ENV: "production", BROKER_SITES_BASE_DOMAIN: "vitoriamaison.com.br" });
    expect(routeRequest("ana.vitoriamaison.com.br", "/", off)).toEqual({ type: "notFound" });
    expect(routeRequest("vitoriamaison.com.br", "/", off)).toEqual({ type: "next" });
  });
  it("chaves de cache diferentes por hostname: o subdomínio faz parte do caminho reescrito", () => {
    const a = routeRequest("ana.vitoriamaison.com.br", "/", prod);
    const b = routeRequest("joao.vitoriamaison.com.br", "/", prod);
    expect(a.type === "rewrite" && b.type === "rewrite" && a.pathname !== b.pathname).toBe(true);
  });
});

describe("regras de subdomínio", () => {
  it("aceita minúsculas ASCII, números e hífens internos", () => {
    expect(validateSubdomain("ana")).toEqual({ ok: true, subdomain: "ana" });
    expect(validateSubdomain("  Joao-Silva2 ")).toEqual({ ok: true, subdomain: "joao-silva2" });
  });
  it("recusa vazio, curto, longo, espaços, pontos, acentos, hífens nas bordas e duplos", () => {
    const problem = (value: string) => { const result = validateSubdomain(value); return result.ok ? null : result.problem; };
    expect(problem("")).toBe("EMPTY");
    expect(problem("ab")).toBe("TOO_SHORT");
    expect(problem("a".repeat(31))).toBe("TOO_LONG");
    expect(problem("ana souza")).toBe("INVALID_CHARACTERS");
    expect(problem("ana.souza")).toBe("INVALID_CHARACTERS");
    expect(problem("joão")).toBe("INVALID_CHARACTERS");
    expect(problem("-ana")).toBe("EDGE_HYPHEN");
    expect(problem("ana-")).toBe("EDGE_HYPHEN");
    expect(problem("ana--souza")).toBe("CONSECUTIVE_HYPHENS");
  });
  it("bloqueia reservados e nomes que imitam áreas oficiais", () => {
    for (const value of ["www", "admin", "api", "app", "mail", "smtp", "ftp", "suporte", "contato", "blog", "status", "assets", "static", "cdn", "auth", "login", "dashboard", "vitoria", "maison", "vitoriamaison"]) expect(RESERVED_SUBDOMAINS.has(value)).toBe(true);
    for (const value of ["admin-ana", "suporte-maison", "ana-oficial", "vitoriamaison-sp", "casa-maison"]) expect(validateSubdomain(value)).toMatchObject({ ok: false, problem: "RESERVED" });
  });
  it("normaliza nomes e gera alternativas válidas", () => {
    expect(normalizeSubdomainCandidate("Ana Souza Lima")).toBe("ana-souza-lima");
    expect(normalizeSubdomainCandidate("João  D'Ávila!!")).toBe("joao-d-avila");
    const candidates = subdomainCandidates("Ana");
    expect(candidates[0]).toBe("ana");
    expect(candidates).toContain("ana-2");
    expect(subdomainCandidates("a".repeat(40)).every((candidate) => candidate.length <= 30)).toBe(true);
  });
});

describe("status e acesso", () => {
  it("máquina de estados", () => {
    expect(canTransition("DRAFT", "SUBMIT")).toBe(true);
    expect(canTransition("DRAFT", "APPROVE")).toBe(false);
    expect(canTransition("IN_REVIEW", "APPROVE")).toBe(true);
    expect(canTransition("PUBLISHED", "SUBMIT")).toBe(false);
    expect(canTransition("SUSPENDED", "APPROVE")).toBe(false);
    expect(canTransition("SUSPENDED", "REACTIVATE")).toBe(true);
    expect(["DRAFT", "IN_REVIEW", "SUSPENDED"].some((status) => isPubliclyVisible(status as never))).toBe(false);
    expect(isPubliclyVisible("PUBLISHED")).toBe(true);
  });
  it("propriedade do recurso + permissão; ADMIN gerencia todos; MANAGER não", () => {
    const site = { ownerUserId: "dono" };
    const actor = (id: string, ...roles: string[]) => ({ id, active: true, roles });
    expect(canAccessBrokerSite(actor("dono", "BROKER"), site, "update")).toBe(true);
    expect(canAccessBrokerSite(actor("outro", "BROKER"), site, "update")).toBe(false);
    expect(canAccessBrokerSite(actor("dono", "BROKER"), site, "approve")).toBe(false);
    expect(canAccessBrokerSite(actor("gestor", "MANAGER"), site, "read")).toBe(false);
    expect(canAccessBrokerSite(actor("dono", "MANAGER", "BROKER"), site, "submit")).toBe(true);
    expect(canAccessBrokerSite(actor("admin", "ADMIN"), site, "approve")).toBe(true);
    expect(canAccessBrokerSite({ id: "dono", active: false, roles: ["BROKER"] }, site, "read")).toBe(false);
  });
});
