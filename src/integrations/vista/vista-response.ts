export function extractVistaRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["imoveis", "Imoveis", "items", "data", "lista"]) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }
  return Object.values(payload).filter((value): value is Record<string, unknown> => isRecord(value) && "Codigo" in value);
}

export function extractVistaDetail(payload: unknown): Record<string, unknown> | null {
  if (isRecord(payload) && "Codigo" in payload) return payload;
  return extractVistaRecords(payload)[0] ?? null;
}

export function extractVistaPagination(payload: unknown, fallback: { page: number; pageSize: number; records: number }) {
  if (!isRecord(payload)) return { total: fallback.records, pages: fallback.records ? 1 : 0, page: fallback.page, pageSize: fallback.pageSize };
  const metadata = [payload, payload.totalizadores, payload.pagination, payload.paginacao].find((value) => isRecord(value) && ("total" in value || "paginas" in value));
  if (!isRecord(metadata)) return { total: fallback.records, pages: fallback.records ? 1 : 0, page: fallback.page, pageSize: fallback.pageSize };
  return {
    total: positiveInteger(metadata.total, fallback.records),
    pages: positiveInteger(metadata.paginas, fallback.records ? 1 : 0),
    page: positiveInteger(metadata.pagina, fallback.page),
    pageSize: positiveInteger(metadata.quantidade, fallback.pageSize),
  };
}

export function analyzePhotoFields(payload: unknown): {
  coverPresent: boolean;
  galleryCount: number;
  absoluteHttps: number;
  invalidOrNonHttps: number;
  smallImages: number;
  descriptions: number;
} {
  const detail = extractVistaDetail(payload) ?? {};
  const urls: unknown[] = [];
  if (detail.FotoDestaque) urls.push(detail.FotoDestaque);
  const photos = Array.isArray(detail.fotos) ? detail.fotos.filter(isRecord) : [];
  for (const photo of photos) { urls.push(photo.Foto, photo.FotoPequena); }
  const validUrls = urls.filter((value): value is string => typeof value === "string" && value.length > 0);
  const absoluteHttps = validUrls.filter((value) => { try { return new URL(value).protocol === "https:"; } catch { return false; } }).length;
  return {
    coverPresent: typeof detail.FotoDestaque === "string" && detail.FotoDestaque.length > 0,
    galleryCount: photos.length,
    absoluteHttps,
    invalidOrNonHttps: validUrls.length - absoluteHttps,
    smallImages: photos.filter((photo) => typeof photo.FotoPequena === "string" && photo.FotoPequena.length > 0).length,
    descriptions: photos.filter((photo) => typeof photo.Descricao === "string" && photo.Descricao.length > 0).length,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
