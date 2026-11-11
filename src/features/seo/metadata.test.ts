import { describe, expect, it } from "vitest";
import { buildNoIndexMetadata, buildPageMetadata, truncateText } from "./metadata";
import { blockedConfig, indexableConfig } from "./fixtures";
import { DEFAULT_SHARE_IMAGE_PATH, getSeoConfig } from "./config";

describe("buildPageMetadata", () => {
  it("gera canonical absoluto, Open Graph, Twitter e robots indexáveis", () => {
    const metadata = buildPageMetadata({ title: "Contato", description: "Fale com a equipe.", path: "/contato" }, indexableConfig());
    expect(metadata.alternates?.canonical).toBe("https://www.vitoria-maison.test/contato");
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.openGraph).toMatchObject({ url: "https://www.vitoria-maison.test/contato", title: "Contato | Vitória Maison", locale: "pt_BR", siteName: "Vitória Maison" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("usa a imagem de marca somente quando não há imagem adequada", () => {
    const fallback = buildPageMetadata({ title: "A", description: "B", path: "/" }, indexableConfig());
    expect(JSON.stringify(fallback.openGraph?.images)).toContain(DEFAULT_SHARE_IMAGE_PATH);
    const real = buildPageMetadata({ title: "A", description: "B", path: "/", images: [{ url: "https://cdn.fotos.test/1.jpg", alt: "Foto" }, { url: "http://inseguro.test/2.jpg", alt: "X" }] }, indexableConfig());
    expect(JSON.stringify(real.openGraph?.images)).toContain("https://cdn.fotos.test/1.jpg");
    expect(JSON.stringify(real.openGraph?.images)).not.toContain("inseguro");
    expect(JSON.stringify(real.openGraph?.images)).not.toContain(DEFAULT_SHARE_IMAGE_PATH);
  });

  it("omite canonical quando a URL do site não está configurada", () => {
    const metadata = buildPageMetadata({ title: "A", description: "B", path: "/contato" }, getSeoConfig({}));
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty("url");
  });

  it("aplica noindex,follow em páginas não indexáveis de produção", () => {
    expect(buildNoIndexMetadata({ title: "Termos", description: "x", path: "/termos" }, indexableConfig()).robots).toMatchObject({ index: false, follow: true });
  });

  it("aplica noindex,nofollow em tudo quando a indexação global está bloqueada", () => {
    expect(buildPageMetadata({ title: "Home", description: "x", path: "/" }, blockedConfig()).robots).toMatchObject({ index: false, follow: false });
  });

  it("aceita título absoluto na home e mantém o H1 fora da metadata", () => {
    const metadata = buildPageMetadata({ title: "Vitória Maison | Imóveis Selecionados em São Paulo", absoluteTitle: true, description: "x", path: "/" }, indexableConfig());
    expect(metadata.title).toEqual({ absolute: "Vitória Maison | Imóveis Selecionados em São Paulo" });
  });
});

describe("truncateText", () => {
  it("corta em limite de palavra sem ultrapassar 160 caracteres", () => {
    const text = "palavra ".repeat(40);
    const result = truncateText(text);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith("…")).toBe(true);
    expect(truncateText("  curto  ")).toBe("curto");
  });
});
