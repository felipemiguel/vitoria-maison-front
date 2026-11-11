/**
 * Política de indexação de URLs com parâmetros (catálogo, comprar, alugar).
 *
 * - Apenas `pagina` é considerado parte da URL canônica (paginação com canonical próprio).
 * - Parâmetros de rastreamento são ignorados: a página continua indexável, com canonical limpo.
 * - Qualquer filtro, ordenação ou busca torna a página `noindex, follow`, com canonical na rota base.
 * - Resultados vazios nunca são indexados.
 *
 * O robots.txt NÃO bloqueia essas URLs: o rastreador precisa acessá-las para enxergar o `noindex`.
 */

const TRACKING_PARAM = /^(utm_[a-z_]+|gclid|gbraid|wbraid|fbclid|msclkid|dclid|yclid|mc_cid|mc_eid|_ga|_gl|ref|igshid)$/i;
export const PAGE_PARAM = "pagina";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ListingIndexability = {
  indexable: boolean;
  canonicalPath: string;
  reason: "BASE" | "PAGINATED" | "FILTERED" | "EMPTY" | "INVALID_PAGE";
};

export function isTrackingParam(name: string): boolean { return TRACKING_PARAM.test(name); }

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function listingIndexability(basePath: string, params: RawSearchParams, resultCount: number, totalPages = 1): ListingIndexability {
  const meaningful = Object.entries(params)
    .filter(([name, value]) => !isTrackingParam(name) && (firstValue(value) ?? "").trim() !== "");
  const filters = meaningful.filter(([name]) => name !== PAGE_PARAM);
  const rawPage = firstValue(params[PAGE_PARAM]);
  const page = rawPage === undefined ? 1 : Number(rawPage);

  if (filters.length > 0) return { indexable: false, canonicalPath: basePath, reason: "FILTERED" };
  if (!Number.isInteger(page) || page < 1 || page > totalPages) return { indexable: false, canonicalPath: basePath, reason: "INVALID_PAGE" };
  if (resultCount === 0) return { indexable: false, canonicalPath: basePath, reason: "EMPTY" };
  if (page > 1) return { indexable: true, canonicalPath: `${basePath}?${PAGE_PARAM}=${page}`, reason: "PAGINATED" };
  return { indexable: true, canonicalPath: basePath, reason: "BASE" };
}

/** Mínimo de imóveis elegíveis para uma coleção publicada ser indexável. */
export const MIN_INDEXABLE_COLLECTION_ITEMS = 1;

export function isCollectionIndexable(eligibleItems: number): boolean {
  return eligibleItems >= MIN_INDEXABLE_COLLECTION_ITEMS;
}
