import type { Property, PropertyPurpose, PropertyType } from "@/features/properties/types";
import { truncateText } from "./metadata";

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = { APARTMENT: "Apartamento", FLAT: "Flat", STUDIO: "Studio", PENTHOUSE: "Cobertura" };
export const PURPOSE_LABEL: Record<PropertyPurpose, string> = { SALE: "à venda", RENT: "para alugar", INVESTMENT: "para investimento" };

/** Bairros cujo uso consagrado pede artigo. Os demais usam "em", que é correto para qualquer nome. */
const NEIGHBORHOOD_PREPOSITION: Record<string, string> = { jardins: "nos" };

export function locationPhrase(neighborhood: string): string {
  const name = neighborhood.trim();
  return `${NEIGHBORHOOD_PREPOSITION[name.toLowerCase()] ?? "em"} ${name}`;
}

function formatArea(area: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(area)} m²`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

/**
 * Título baseado somente em atributos reais: categoria, finalidade, bairro e área.
 * A área diferencia imóveis semelhantes no mesmo bairro sem recorrer a adjetivos inventados.
 */
export function propertySeoTitle(property: Property): string {
  const c = property.commercial;
  const base = `${PROPERTY_TYPE_LABEL[c.type]} ${PURPOSE_LABEL[c.purpose]} ${locationPhrase(property.location.neighborhood)}`;
  return c.area > 0 ? `${base}, ${formatArea(c.area)}` : base;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Resumo factual dos atributos existentes. Atributos ausentes são omitidos, nunca estimados. */
export function propertyFactsSentence(property: Property): string {
  const c = property.commercial;
  const facts = [
    c.area > 0 ? `${formatArea(c.area)} de área privativa` : undefined,
    c.bedrooms ? plural(c.bedrooms, "dormitório", "dormitórios") : undefined,
    c.suites ? plural(c.suites, "suíte", "suítes") : undefined,
    c.parkingSpaces ? plural(c.parkingSpaces, "vaga", "vagas") : undefined,
  ].filter(Boolean);
  const head = `${PROPERTY_TYPE_LABEL[c.type]} ${PURPOSE_LABEL[c.purpose]} ${locationPhrase(property.location.neighborhood)}, ${property.location.city}`;
  const price = c.price > 0 ? ` ${c.purpose === "RENT" ? "Aluguel" : "Valor"}: ${formatMoney(c.price)}.` : "";
  return `${head}${facts.length ? `, com ${facts.join(", ")}` : ""}.${price}`;
}

/**
 * Descrição única por imóvel. Usa o texto editorial Maison quando houver; caso contrário,
 * apenas os atributos confirmados no snapshot publicado.
 */
export function propertySeoDescription(property: Property): string {
  const editorial = property.editorial.descriptionSource === "editorial" ? property.editorial.description.trim() : "";
  if (editorial.length >= 60) return truncateText(editorial);
  return truncateText(`${propertyFactsSentence(property)} Código ${property.commercial.code}. Curadoria Vitória Maison.`);
}
