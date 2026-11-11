/**
 * Redirecionamentos do site legado Vitória Flats (vitoriaflats.com.br).
 *
 * Somente correspondências reais, levantadas no sitemap público do legado em 10/11/2026.
 * Sem dependências: este arquivo é importado pelo next.config.ts.
 *
 * Páginas legadas sem equivalente (/favoritos, /comparar) ficam sem redirecionamento e respondem 404.
 * Imóveis legados (/imovel/<slug>-<codigo>) são resolvidos dinamicamente por código Vista em
 * src/app/imovel/[slug]/page.tsx: apenas imóveis selecionados e elegíveis redirecionam.
 */

export type LegacyRedirect = { source: string; destination: string; statusCode: 301 };

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  { source: "/anuncie", destination: "/anuncie-seu-imovel", statusCode: 301 },
  { source: "/politica-privacidade", destination: "/privacidade", statusCode: 301 },
  { source: "/busca", destination: "/imoveis", statusCode: 301 },
];

/** Extrai o código Vista do final de uma URL legada de imóvel. Ex.: flat-campo-belo-...-26m2-16786218 → 16786218 */
export function legacyPropertyCode(slug: string): string | null {
  const match = /^[a-z0-9.-]+-(\d{2,12})$/i.exec(slug.trim());
  return match ? match[1] : null;
}

/** Valida a lista: sem loops, sem cadeias, sem destino na home e sem origens duplicadas. */
export function validateRedirects(redirects: LegacyRedirect[]): string[] {
  const errors: string[] = [];
  const sources = new Set<string>();
  for (const redirect of redirects) {
    if (!redirect.source.startsWith("/") || !redirect.destination.startsWith("/")) errors.push(`Caminho relativo inválido: ${redirect.source}`);
    if (sources.has(redirect.source)) errors.push(`Origem duplicada: ${redirect.source}`);
    sources.add(redirect.source);
    if (redirect.source === redirect.destination) errors.push(`Loop: ${redirect.source}`);
    if (redirect.destination === "/") errors.push(`Redirecionamento genérico para a home: ${redirect.source}`);
  }
  for (const redirect of redirects) if (sources.has(redirect.destination)) errors.push(`Cadeia: ${redirect.source} → ${redirect.destination}`);
  return errors;
}
