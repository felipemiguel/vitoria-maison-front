import type { PropertyFilters, PropertyPurpose, PropertyType } from "@/features/properties/types";
import type { RawSearchParams } from "./indexing";

const PURPOSES: PropertyPurpose[] = ["SALE", "RENT", "INVESTMENT"];
const TYPES: PropertyType[] = ["APARTMENT", "FLAT", "STUDIO", "PENTHOUSE"];
const SORTS = ["price-asc", "price-desc", "area-desc"] as const;

function first(value: string | string[] | undefined): string | undefined {
  const item = Array.isArray(value) ? value[0] : value;
  const trimmed = item?.trim();
  return trimmed ? trimmed : undefined;
}

function boundedInt(value: string | undefined, min: number, max: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : undefined;
}

/**
 * Converte parâmetros da URL em filtros válidos. Valores desconhecidos são descartados,
 * evitando erros 500 em URLs arbitrárias acessadas por rastreadores.
 */
export function parseCatalogParams(params: RawSearchParams, fixedPurpose?: PropertyPurpose): PropertyFilters {
  const purpose = fixedPurpose ?? (PURPOSES as string[]).find((item) => item === first(params.finalidade)) as PropertyPurpose | undefined;
  const type = (TYPES as string[]).find((item) => item === first(params.tipo)) as PropertyType | undefined;
  const sort = (SORTS as readonly string[]).find((item) => item === first(params.ordem)) as PropertyFilters["sort"];
  const neighborhood = first(params.bairro);
  return {
    purpose,
    type,
    sort,
    neighborhood: neighborhood && neighborhood.length <= 80 ? neighborhood : undefined,
    maxPrice: boundedInt(first(params.valorMax), 1, 1_000_000_000),
    minArea: boundedInt(first(params.areaMin), 1, 100_000),
    bedrooms: boundedInt(first(params.dormitorios), 1, 20),
    page: boundedInt(first(params.pagina), 1, 10_000) ?? 1,
  };
}

/** Rota pública equivalente a uma finalidade. INVESTMENT permanece no catálogo filtrado (/investir é consultoria). */
export function catalogPathForPurpose(purpose: string | undefined): { path: string; keepPurposeParam: boolean } {
  if (purpose === "SALE") return { path: "/comprar", keepPurposeParam: false };
  if (purpose === "RENT") return { path: "/alugar", keepPurposeParam: false };
  return { path: "/imoveis", keepPurposeParam: Boolean(purpose) };
}
