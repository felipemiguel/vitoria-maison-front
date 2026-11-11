import { z } from "zod";
import type { VistaExplorerFilters } from "./types";

const text = z.string().trim().max(160).optional().transform((value) => value || undefined);
const code = z.string().trim().max(80).regex(/^[\p{L}\p{N}._-]*$/u).optional().transform((value) => value || undefined);
const optionalMoney = z.preprocess((value) => value === "" || value === undefined ? undefined : value, z.coerce.number().nonnegative().max(1_000_000_000).optional());
const optionalBedrooms = z.preprocess((value) => value === "" || value === undefined ? undefined : value, z.coerce.number().int().min(0).max(50).optional());

export const explorerFiltersSchema = z.object({
  code,
  city: text,
  neighborhood: text,
  category: text,
  minPrice: optionalMoney,
  maxPrice: optionalMoney,
  bedrooms: optionalBedrooms,
  onlyNotImported: z.union([z.literal("1"), z.literal("true")]).optional().transform(Boolean),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(20), z.literal(50)])).catch(20),
  view: z.union([z.literal("cards"), z.literal("list")]).catch("cards"),
}).superRefine((value, context) => {
  if (value.minPrice !== undefined && value.maxPrice !== undefined && value.minPrice > value.maxPrice) {
    context.addIssue({ code: "custom", path: ["maxPrice"], message: "O valor máximo deve ser maior ou igual ao mínimo." });
  }
});

export function parseExplorerFilters(input: Record<string, string | string[] | undefined>): VistaExplorerFilters {
  const flat = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  return explorerFiltersSchema.parse(flat);
}

export const bulkImportInputSchema = z.object({
  codes: z.array(z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N}._-]+$/u)).min(1).max(20).transform((codes) => [...new Set(codes)]),
  idempotencyKey: z.string().trim().min(1).max(200),
});

export function buildVistaFilters(filters: VistaExplorerFilters): { filter?: Record<string, unknown>; advFilter?: Record<string, unknown> } {
  const filter: Record<string, unknown> = {};
  if (filters.code) filter.Codigo = filters.code;
  if (filters.city) filter.Cidade = ["like", filters.city];
  if (filters.neighborhood) filter.Bairro = ["like", filters.neighborhood];
  if (filters.category) filter.Categoria = ["like", filters.category];
  if (filters.bedrooms !== undefined) filter.Dormitorios = filters.bedrooms;
  const range = priceRange(filters.minPrice, filters.maxPrice);
  const advFilter = range ? { Or: { ValorVenda: range, ValorLocacao: range } } : undefined;
  return { ...(Object.keys(filter).length ? { filter } : {}), ...(advFilter ? { advFilter } : {}) };
}

function priceRange(minimum?: number, maximum?: number): unknown[] | undefined {
  if (minimum !== undefined && maximum !== undefined) return [minimum, maximum];
  if (minimum !== undefined) return [">=", minimum];
  if (maximum !== undefined) return ["<=", maximum];
  return undefined;
}
