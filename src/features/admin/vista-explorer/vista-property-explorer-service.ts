import type { VistaClient } from "@/integrations/vista/vista-types";
import { VISTA_DETAIL_FIELDS, VISTA_LIST_FIELDS } from "@/integrations/vista/vista-fields";
import { extractVistaDetail } from "@/integrations/vista/vista-response";
import { normalizeVistaCommercialData } from "@/integrations/vista/vista-mapper";
import { buildVistaFilters } from "./validation";
import { mapVistaPropertyList } from "./vista-property-list-mapper";
import type { VistaExplorerFilters, VistaExplorerPage, VistaExplorerPreview, VistaImportStatus } from "./types";

export interface VistaImportStatusStore {
  findByCodes(codes: string[]): Promise<Map<string, VistaImportStatus>>;
}

export class VistaPropertyExplorerService {
  constructor(
    private readonly vista: VistaClient,
    private readonly statuses: VistaImportStatusStore,
    private readonly imageHostname?: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(filters: VistaExplorerFilters): Promise<VistaExplorerPage> {
    const vistaFilters = buildVistaFilters(filters);
    const payload = await this.vista.listProperties({
      fields: VISTA_LIST_FIELDS,
      page: filters.page,
      pageSize: filters.pageSize,
      showTotal: true,
      ...vistaFilters,
      order: { Codigo: "asc" },
    });
    const mapped = mapVistaPropertyList(payload, { page: filters.page, pageSize: filters.pageSize, allowedImageHostname: this.imageHostname });
    const statuses = await this.statuses.findByCodes(mapped.items.map((item) => item.code));
    const items = mapped.items
      .map((item) => ({ ...item, importStatus: statuses.get(item.code) ?? { kind: "NOT_IMPORTED" as const } }))
      .filter((item) => !filters.onlyNotImported || item.importStatus.kind === "NOT_IMPORTED");
    return { ...mapped, items };
  }

  async preview(code: string): Promise<VistaExplorerPreview> {
    const payload = await this.vista.getPropertyDetails(code, { fields: VISTA_DETAIL_FIELDS });
    const detail = extractVistaDetail(payload);
    if (!detail) throw new Error("Imóvel não encontrado no Vista.");
    const property = normalizeVistaCommercialData(detail, this.now(), this.imageHostname);
    const imported = (await this.statuses.findByCodes([property.externalCode])).get(property.externalCode) ?? { kind: "NOT_IMPORTED" as const };
    return { ...property, imported };
  }
}
