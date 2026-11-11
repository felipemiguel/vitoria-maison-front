import type { PropertyType } from "./types";

export const categoryAliases: Record<PropertyType, string[]> = {
  APARTMENT: ["apartamento", "apartamento residencial"],
  FLAT: ["flat", "apart hotel", "apart-hotel"],
  STUDIO: ["studio", "estúdio"],
  PENTHOUSE: ["cobertura", "cobertura duplex"],
};

export const allKnownCategories = Object.values(categoryAliases).flat();

export function mapCategory(value: string | null | undefined): PropertyType | null {
  if (!value) return null;
  const normalized = value.trim().toLocaleLowerCase("pt-BR");
  return (Object.entries(categoryAliases).find(([, aliases]) => aliases.includes(normalized))?.[0] as PropertyType | undefined) ?? null;
}
