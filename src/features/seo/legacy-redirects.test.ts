import { describe, expect, it } from "vitest";
import { LEGACY_REDIRECTS, legacyPropertyCode, validateRedirects } from "./legacy-redirects";
import nextConfig from "../../../next.config";

describe("redirecionamentos do legado", () => {
  it("lista válida: sem loops, cadeias, duplicatas ou envio genérico para a home", () => {
    expect(validateRedirects(LEGACY_REDIRECTS)).toEqual([]);
  });

  it("o validador detecta problemas", () => {
    expect(validateRedirects([{ source: "/a", destination: "/a", statusCode: 301 }])).toContain("Loop: /a");
    expect(validateRedirects([{ source: "/a", destination: "/b", statusCode: 301 }, { source: "/b", destination: "/c", statusCode: 301 }])).toContain("Cadeia: /a → /b");
    expect(validateRedirects([{ source: "/imovel-antigo", destination: "/", statusCode: 301 }])).toContain("Redirecionamento genérico para a home: /imovel-antigo");
  });

  it("todos os destinos são rotas existentes do novo site", () => {
    const existing = new Set(["/anuncie-seu-imovel", "/privacidade", "/imoveis"]);
    for (const redirect of LEGACY_REDIRECTS) expect(existing.has(redirect.destination), redirect.destination).toBe(true);
  });

  it("next.config publica os redirecionamentos como 301", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual(LEGACY_REDIRECTS.map(({ source, destination }) => ({ source, destination, statusCode: 301 })));
  });

  it("extrai o código Vista do final da URL legada de imóvel", () => {
    expect(legacyPropertyCode("flat-campo-belo-sao-paulo-sp-1-quartos-26m2-16786218")).toBe("16786218");
    expect(legacyPropertyCode("apartamento-jardim-paulista-sao-paulo-sp-1-quartos-52.22m2-17835413")).toBe("17835413");
    expect(legacyPropertyCode("studio-vila-mariana-sao-paulo-sp-17835621")).toBe("17835621");
    expect(legacyPropertyCode("sem-codigo")).toBeNull();
    expect(legacyPropertyCode("../../etc-1234")).toBeNull();
  });
});

describe("cabeçalhos de noindex", () => {
  it("admin e API enviam X-Robots-Tag noindex", async () => {
    const headers = await nextConfig.headers!();
    for (const source of ["/admin", "/admin/:path*", "/api/:path*"]) {
      const rule = headers.find((item) => item.source === source);
      expect(rule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    }
  });
});
