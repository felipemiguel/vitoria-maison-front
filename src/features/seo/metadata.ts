import type { Metadata } from "next";
import { BRAND_NAME, DEFAULT_SHARE_IMAGE_PATH, DEFAULT_SHARE_IMAGE_SIZE, SITE_LOCALE, absoluteUrl, getSeoConfig, isHttpsUrl, type SeoConfig } from "./config";

export type ShareImage = { url: string; alt: string; width?: number; height?: number };

export type PageSeoInput = {
  /** Título sem o sufixo da marca (o template do layout adiciona " | Vitória Maison"). */
  title: string;
  /** Título completo, sem template. Usado na home. */
  absoluteTitle?: boolean;
  description: string;
  /** Caminho canônico, iniciado por "/". Pode conter `?pagina=N`. */
  path: string;
  /** Indexável quando a política da página permitir. A configuração global ainda pode bloquear. */
  index?: boolean;
  images?: ShareImage[];
  type?: "website" | "article";
};

export const DESCRIPTION_MAX_LENGTH = 160;

export function truncateText(text: string, max = DESCRIPTION_MAX_LENGTH): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

export function robotsFor(index: boolean, config: Pick<SeoConfig, "indexingEnabled">): NonNullable<Metadata["robots"]> {
  if (!config.indexingEnabled) return { index: false, follow: false, googleBot: { index: false, follow: false } };
  if (!index) return { index: false, follow: true, googleBot: { index: false, follow: true } };
  return { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } };
}

export function defaultShareImage(): ShareImage {
  return { url: DEFAULT_SHARE_IMAGE_PATH, alt: `${BRAND_NAME} — imóveis selecionados em São Paulo`, ...DEFAULT_SHARE_IMAGE_SIZE };
}

/** Utilitário central de metadata para páginas públicas. */
export function buildPageMetadata(input: PageSeoInput, config: SeoConfig = getSeoConfig()): Metadata {
  const description = truncateText(input.description);
  const images = (input.images ?? []).filter((image) => image.url.startsWith("/") || isHttpsUrl(image.url));
  const shareImages = images.length ? images : [defaultShareImage()];
  const fullTitle = input.absoluteTitle ? input.title : `${input.title} | ${BRAND_NAME}`;
  // Sem URL configurada, o canonical é omitido: um canonical relativo é inválido.
  const canonical = absoluteUrl(config, input.path);
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    robots: robotsFor(input.index ?? true, config),
    openGraph: {
      type: input.type ?? "website",
      locale: SITE_LOCALE,
      siteName: BRAND_NAME,
      ...(canonical ? { url: canonical } : {}),
      title: fullTitle,
      description,
      images: shareImages,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: shareImages.map((image) => ({ url: image.url, alt: image.alt })),
    },
  };
}

/** Metadata para páginas que nunca devem ser indexadas (demonstrativas, provisórias, privadas). */
export function buildNoIndexMetadata(input: Omit<PageSeoInput, "index">, config: SeoConfig = getSeoConfig()): Metadata {
  return buildPageMetadata({ ...input, index: false }, config);
}
