import { describe, expect, it } from "vitest";
import { absoluteUrl, getSeoConfig, parseSiteUrl } from "./config";
import { productionEnv } from "./fixtures";

describe("getSeoConfig", () => {
  it("libera indexação somente com todas as condições de lançamento", () => {
    const config = getSeoConfig(productionEnv);
    expect(config.indexingEnabled).toBe(true);
    expect(config.indexingBlockers).toEqual([]);
    expect(config.siteUrl?.toString()).toBe("https://www.vitoria-maison.test/");
  });

  it("bloqueia por padrão (flag ausente)", () => {
    const config = getSeoConfig({ ...productionEnv, SITE_INDEXING_ENABLED: undefined });
    expect(config.indexingEnabled).toBe(false);
    expect(config.indexingBlockers).toContain("INDEXING_FLAG_DISABLED");
  });

  it("nunca indexa conteúdo mock, mesmo em produção com a flag ligada", () => {
    for (const source of ["mock", undefined]) {
      const config = getSeoConfig({ ...productionEnv, PROPERTY_DATA_SOURCE: source });
      expect(config.indexingEnabled).toBe(false);
      expect(config.indexingBlockers).toContain("MOCK_DATA_SOURCE");
    }
  });

  it("nunca indexa previews nem builds de desenvolvimento", () => {
    expect(getSeoConfig({ ...productionEnv, VERCEL_ENV: "preview" }).indexingBlockers).toContain("PREVIEW_DEPLOYMENT");
    expect(getSeoConfig({ ...productionEnv, NODE_ENV: "development" }).indexingBlockers).toContain("NOT_PRODUCTION_BUILD");
    expect(getSeoConfig({ ...productionEnv, VERCEL_ENV: "production" }).indexingEnabled).toBe(true);
  });

  it("rejeita URLs de exemplo, sem HTTPS ou inválidas", () => {
    expect(parseSiteUrl("https://www.seu-dominio.com.br").blocker).toBe("SITE_URL_PLACEHOLDER");
    expect(parseSiteUrl("https://DOMINIO-DEFINITIVO").blocker).toBe("SITE_URL_PLACEHOLDER");
    expect(parseSiteUrl("http://www.vitoria-maison.test").blocker).toBe("SITE_URL_NOT_HTTPS");
    expect(parseSiteUrl("não é url").blocker).toBe("SITE_URL_INVALID");
    expect(parseSiteUrl("").blocker).toBe("SITE_URL_MISSING");
    expect(getSeoConfig({ ...productionEnv, NEXT_PUBLIC_SITE_URL: "https://www.seu-dominio.com.br" }).indexingEnabled).toBe(false);
  });

  it("normaliza a URL para a origem e monta URLs absolutas", () => {
    const config = getSeoConfig({ ...productionEnv, NEXT_PUBLIC_SITE_URL: "https://www.vitoria-maison.test/qualquer/caminho/" });
    expect(absoluteUrl(config, "/imoveis/vista-1")).toBe("https://www.vitoria-maison.test/imoveis/vista-1");
    expect(absoluteUrl({ siteUrl: null }, "/imoveis")).toBeUndefined();
  });

  it("usa apenas dados públicos configurados da organização", () => {
    const config = getSeoConfig({ ...productionEnv, NEXT_PUBLIC_CONTACT_EMAIL: "contato@vitoria-maison.test", NEXT_PUBLIC_WHATSAPP_NUMBER: "(11) 90000-0000", SEO_ORGANIZATION_SAME_AS: "https://instagram.test/vm, javascript:alert(1), http://inseguro.test" });
    expect(config.organization).toEqual({ email: "contato@vitoria-maison.test", telephone: "+11900000000", sameAs: ["https://instagram.test/vm"] });
    expect(getSeoConfig(productionEnv).organization).toEqual({ email: undefined, telephone: undefined, sameAs: [] });
  });
});
