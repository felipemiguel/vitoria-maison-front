/**
 * Configuração central de SEO.
 *
 * A indexação só é liberada quando TODAS as condições forem verdadeiras:
 * - SITE_INDEXING_ENABLED=true (decisão explícita de lançamento);
 * - NEXT_PUBLIC_SITE_URL válida, HTTPS e diferente dos valores de exemplo;
 * - PROPERTY_DATA_SOURCE=database (conteúdo mock nunca é indexado);
 * - NODE_ENV=production;
 * - VERCEL_ENV, quando existir, igual a "production" (previews nunca indexam).
 */

export const BRAND_NAME = "Vitória Maison";
export const SITE_LOCALE = "pt_BR";
export const SITE_LANGUAGE = "pt-BR";
export const SITE_DESCRIPTION = "Descubra apartamentos, flats, studios e oportunidades de investimento selecionados pela Vitória Maison em São Paulo.";
export const SITE_TAGLINE = "Imóveis Selecionados em São Paulo";
export const BRAND_LOGO_PATH = "/images/brand/vitoria-maison-logo-horizontal.png";
export const DEFAULT_SHARE_IMAGE_PATH = "/og/marca.png";
export const DEFAULT_SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

const PLACEHOLDER_HOST_FRAGMENTS = ["seu-dominio", "dominio-definitivo", "example.com", "example.org"];

export type IndexingBlocker =
  | "INDEXING_FLAG_DISABLED"
  | "SITE_URL_MISSING"
  | "SITE_URL_INVALID"
  | "SITE_URL_NOT_HTTPS"
  | "SITE_URL_PLACEHOLDER"
  | "MOCK_DATA_SOURCE"
  | "NOT_PRODUCTION_BUILD"
  | "PREVIEW_DEPLOYMENT";

export type SeoConfig = {
  /** URL canônica configurada (sem barra final). `null` quando ausente ou inválida. */
  siteUrl: URL | null;
  indexingEnabled: boolean;
  indexingBlockers: IndexingBlocker[];
  googleSiteVerification?: string;
  organization: {
    email?: string;
    telephone?: string;
    sameAs: string[];
  };
};

type Env = Partial<Record<string, string | undefined>>;

export function parseSiteUrl(raw: string | undefined): { url: URL | null; blocker?: IndexingBlocker } {
  const value = raw?.trim();
  if (!value) return { url: null, blocker: "SITE_URL_MISSING" };
  let url: URL;
  try { url = new URL(value); } catch { return { url: null, blocker: "SITE_URL_INVALID" }; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { url: null, blocker: "SITE_URL_INVALID" };
  const normalized = new URL(url.origin);
  const host = normalized.hostname.toLowerCase();
  if (PLACEHOLDER_HOST_FRAGMENTS.some((fragment) => host.includes(fragment))) return { url: normalized, blocker: "SITE_URL_PLACEHOLDER" };
  if (normalized.protocol !== "https:") return { url: normalized, blocker: "SITE_URL_NOT_HTTPS" };
  return { url: normalized };
}

export function getSeoConfig(env: Env = process.env): SeoConfig {
  const blockers: IndexingBlocker[] = [];
  if (env.SITE_INDEXING_ENABLED?.trim() !== "true") blockers.push("INDEXING_FLAG_DISABLED");
  const site = parseSiteUrl(env.NEXT_PUBLIC_SITE_URL);
  if (site.blocker) blockers.push(site.blocker);
  if ((env.PROPERTY_DATA_SOURCE?.trim() || "mock") !== "database") blockers.push("MOCK_DATA_SOURCE");
  if (env.NODE_ENV !== "production") blockers.push("NOT_PRODUCTION_BUILD");
  const vercelEnv = env.VERCEL_ENV?.trim();
  if (vercelEnv && vercelEnv !== "production") blockers.push("PREVIEW_DEPLOYMENT");

  return {
    siteUrl: site.url,
    indexingEnabled: blockers.length === 0,
    indexingBlockers: blockers,
    googleSiteVerification: env.GOOGLE_SITE_VERIFICATION?.trim() || undefined,
    organization: {
      email: validEmail(env.NEXT_PUBLIC_CONTACT_EMAIL),
      telephone: validPhone(env.NEXT_PUBLIC_WHATSAPP_NUMBER),
      sameAs: (env.SEO_ORGANIZATION_SAME_AS ?? "").split(",").map((item) => item.trim()).filter(isHttpsUrl),
    },
  };
}

/** Constrói uma URL absoluta a partir de um caminho, usando a URL canônica configurada. */
export function absoluteUrl(config: Pick<SeoConfig, "siteUrl">, path: string): string | undefined {
  if (/^https?:\/\//i.test(path)) return path;
  if (!config.siteUrl) return undefined;
  return new URL(path.startsWith("/") ? path : `/${path}`, config.siteUrl).toString();
}

function validEmail(value: string | undefined): string | undefined {
  const email = value?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function validPhone(value: string | undefined): string | undefined {
  const digits = value?.replace(/\D/g, "");
  return digits && digits.length >= 10 && digits.length <= 15 ? `+${digits}` : undefined;
}

export function isHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
