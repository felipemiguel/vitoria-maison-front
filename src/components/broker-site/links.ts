/** Destinos de navegação do site. Em prévia autenticada (painel), tudo é inerte (null). */
export type BrokerLinks = { home: string | null; catalog: string | null; about: string | null; contact: string | null; property: (slug: string) => string | null; catalogQuery: (query: string) => string | null };

export const PUBLIC_LINKS: BrokerLinks = {
  home: "/", catalog: "/imoveis", about: "/#sobre", contact: "/#contato",
  property: (slug) => `/imoveis/${slug}`,
  catalogQuery: (query) => (query ? `/imoveis?${query}` : "/imoveis"),
};

/** Prévia autenticada: navegação real dentro da área protegida do painel (home, catálogo e imóveis). */
export function previewLinks(base: string): BrokerLinks {
  return {
    home: base, catalog: `${base}/imoveis`, about: `${base}#sobre`, contact: `${base}#contato`,
    property: (slug) => `${base}/imoveis/${slug}`,
    catalogQuery: (query) => (query ? `${base}/imoveis?${query}` : `${base}/imoveis`),
  };
}

export function firstName(name: string): string { return name.trim().split(/\s+/)[0] ?? name; }

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
