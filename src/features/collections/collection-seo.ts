import type { PublicCollection } from "./public-collection-service";
import type { Property } from "@/features/properties/types";
import { isHttpsUrl } from "@/features/seo/config";

/** Texto factual quando a coleção não tem descrição cadastrada. Não descreve bairros nem oportunidades. */
export function collectionDescription(collection: Pick<PublicCollection, "name" | "description">, items: number): string {
  return collection.description?.trim() || `Seleção de ${items} ${items === 1 ? "imóvel" : "imóveis"} da coleção ${collection.name}, com curadoria Vitória Maison em São Paulo.`;
}

/** Imagem editorial cadastrada; senão, a fotografia real do primeiro imóvel; senão, fallback da marca (vazio aqui). */
export function collectionShareImages(collection: Pick<PublicCollection, "name" | "coverImageUrl">, items: Property[]): { url: string; alt: string }[] {
  if (isHttpsUrl(collection.coverImageUrl)) return [{ url: collection.coverImageUrl, alt: collection.name }];
  const first = items[0]?.editorial.images[0];
  return first && isHttpsUrl(first.url) ? [{ url: first.url, alt: first.alt }] : [];
}
