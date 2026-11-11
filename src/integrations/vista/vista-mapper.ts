import { z } from "zod";
import type { Property, PropertyCommercialData } from "@/features/properties/types";
import { mapCategory } from "@/features/properties/category-mapping";
import { VistaMappingError } from "./vista-errors";

const numericValue = z.union([z.number(), z.string()]).transform((value, context) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, "")
      : raw;
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;
  context.addIssue({ code: "custom", message: "Valor numérico inválido" });
  return z.NEVER;
});

const optionalNumericValue = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  numericValue.optional(),
);

const vistaPhotoSchema = z.object({
  Foto: z.string().optional(),
  FotoPequena: z.string().optional(),
  Destaque: z.unknown().optional(),
  Tipo: z.string().optional(),
  Descricao: z.string().optional(),
}).passthrough();

export const vistaPropertySchema = z.object({
  Codigo: z.union([z.string(), z.number()]).transform(String),
  Cidade: z.string().min(1),
  Bairro: z.string().min(1),
  Categoria: z.string().optional(),
  TituloSite: z.string().optional(),
  DescricaoWeb: z.string().optional(),
  Finalidade: z.string().optional(),
  DataAtualizacao: z.string().optional(),
  ValorVenda: optionalNumericValue,
  ValorLocacao: optionalNumericValue,
  Dormitorio: optionalNumericValue,
  Dormitorios: optionalNumericValue,
  Suites: optionalNumericValue,
  Vagas: optionalNumericValue,
  AreaTotal: optionalNumericValue,
  AreaPrivativa: optionalNumericValue,
  Caracteristicas: z.unknown().optional().default({}),
  InfraEstrutura: z.unknown().optional().default({}),
  Descricao: z.string().optional().default(""),
  FotoDestaque: z.string().optional(),
  fotos: z.array(vistaPhotoSchema).optional().default([]),
}).passthrough();

export type VistaPropertySnapshot = z.infer<typeof vistaPropertySchema>;
export type VistaMappingContext = Pick<Property["commercial"], "purpose" | "type" | "area"> & {
  state: string;
  title: string;
  curation: Property["curation"];
};

function httpsImage(url: string | undefined, description: string, allowedHostname?: string): Property["editorial"]["images"][number] | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (allowedHostname && parsed.hostname !== allowedHostname) return null;
    return { url: parsed.toString(), alt: description || "Fotografia do imóvel" };
  } catch { return null; }
}

export function parseVistaPropertySnapshot(raw: unknown): VistaPropertySnapshot {
  const result = vistaPropertySchema.safeParse(raw);
  if (!result.success) throw new VistaMappingError("Resposta do Vista não contém os campos mínimos confirmados.", {
    issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })),
  });
  return result.data;
}

export function normalizeVistaCommercialData(raw: unknown, fetchedAt = new Date(), allowedImageHostname?: string): PropertyCommercialData {
  const snapshot = parseVistaPropertySnapshot(raw);
  const cover = httpsImage(snapshot.FotoDestaque, "Imagem de destaque do imóvel", allowedImageHostname);
  return {
    externalCode: snapshot.Codigo,
    rawCategory: snapshot.Categoria,
    sourceTitle: snapshot.TituloSite?.trim() || undefined,
    sourceDescription: snapshot.DescricaoWeb?.trim() || undefined,
    sourcePurpose: snapshot.Finalidade?.trim() || undefined,
    category: mapCategory(snapshot.Categoria) ?? undefined,
    city: snapshot.Cidade,
    neighborhood: snapshot.Bairro,
    salePrice: snapshot.ValorVenda,
    rentalPrice: snapshot.ValorLocacao,
    privateArea: snapshot.AreaPrivativa,
    totalArea: snapshot.AreaTotal,
    bedrooms: snapshot.Dormitorios ?? snapshot.Dormitorio,
    suites: snapshot.Suites,
    parkingSpaces: snapshot.Vagas,
    coverImageUrl: cover?.url,
    images: cover ? [cover] : [],
    characteristics: snapshot.Caracteristicas,
    infrastructure: snapshot.InfraEstrutura,
    availabilityStatus: "UNKNOWN",
    sourceUpdatedAt: parseVistaDate(snapshot.DataAtualizacao),
    fetchedAt,
  };
}

function parseVistaDate(value: string | undefined): Date | undefined {
  if (!value?.trim()) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? `${value.trim()}T00:00:00.000Z` : value.trim();
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function mapVistaProperty(raw: unknown, context?: VistaMappingContext): Property {
  const snapshot = parseVistaPropertySnapshot(raw);
  if (!context) {
    throw new VistaMappingError("O Vista não forneceu dados suficientes para o domínio Maison sem contexto validado.", {
      missing: ["commercial.purpose", "commercial.type", "commercial.area", "location.state", "editorial.title", "curation"],
      externalId: snapshot.Codigo,
    });
  }
  if (context.purpose !== "SALE") {
    throw new VistaMappingError("ValorVenda só pode ser usado em imóveis com finalidade SALE confirmada.", { externalId: snapshot.Codigo });
  }
  if (snapshot.ValorVenda === undefined) {
    throw new VistaMappingError("ValorVenda ausente; o preço não será inventado.", { externalId: snapshot.Codigo });
  }

  const cover = httpsImage(snapshot.FotoDestaque, `Imagem de destaque — ${context.title}`);
  const gallery = snapshot.fotos.flatMap((photo) => {
    const image = httpsImage(photo.Foto, photo.Descricao ?? context.title);
    return image ? [image] : [];
  });
  const images = [cover, ...gallery].filter((image): image is NonNullable<typeof image> => image !== null)
    .filter((image, index, all) => all.findIndex((candidate) => candidate.url === image.url) === index);

  return {
    id: `vista:${snapshot.Codigo}`,
    externalId: snapshot.Codigo,
    slug: `vista-${snapshot.Codigo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
    commercial: {
      purpose: context.purpose,
      type: context.type,
      price: snapshot.ValorVenda,
      area: context.area,
      bedrooms: snapshot.Dormitorios ?? snapshot.Dormitorio,
      parkingSpaces: snapshot.Vagas,
      code: snapshot.Codigo,
    },
    location: { neighborhood: snapshot.Bairro, city: snapshot.Cidade, state: context.state },
    editorial: { title: context.title, description: snapshot.Descricao, images, features: [] },
    curation: context.curation,
  };
}
