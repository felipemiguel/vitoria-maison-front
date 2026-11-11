import { extractVistaPagination, extractVistaRecords } from "@/integrations/vista/vista-response";
import { vistaPropertySchema } from "@/integrations/vista/vista-mapper";
import type { VistaExplorerItem } from "./types";

export function mapVistaPropertyList(payload: unknown, input: { page: number; pageSize: number; allowedImageHostname?: string }) {
  const records = extractVistaRecords(payload);
  const items = records.flatMap((record): Omit<VistaExplorerItem, "importStatus">[] => {
    const parsed = vistaPropertySchema.safeParse(record);
    if (!parsed.success) return [];
    const item = parsed.data;
    return [{
      code: item.Codigo,
      category: item.Categoria?.trim() || null,
      city: item.Cidade?.trim() || null,
      neighborhood: item.Bairro?.trim() || null,
      salePrice: item.ValorVenda ?? null,
      rentalPrice: item.ValorLocacao ?? null,
      privateArea: item.AreaPrivativa ?? null,
      totalArea: item.AreaTotal ?? null,
      bedrooms: item.Dormitorios ?? item.Dormitorio ?? null,
      suites: item.Suites ?? null,
      parkingSpaces: item.Vagas ?? null,
      coverImageUrl: safeImage(item.FotoDestaque, input.allowedImageHostname),
      availabilityStatus: "UNKNOWN",
    }];
  });
  return { items, ...extractVistaPagination(payload, { page: input.page, pageSize: input.pageSize, records: items.length }) };
}

export function safeImage(value: string | undefined, allowedHostname?: string): string | null {
  if (!value || !allowedHostname) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === allowedHostname ? parsed.toString() : null;
  } catch { return null; }
}
