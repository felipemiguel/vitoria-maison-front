import type { VistaClient } from "@/integrations/vista/vista-types";
import { VISTA_DETAIL_FIELDS } from "@/integrations/vista/vista-fields";
import { extractVistaDetail } from "@/integrations/vista/vista-response";
import { normalizeVistaCommercialData } from "@/integrations/vista/vista-mapper";
import { VistaError, VistaMappingError, sanitizeForLog, toSanitizedError } from "@/integrations/vista/vista-errors";
import type { PropertySyncStore, SyncResult } from "./types";

export class PropertySyncService {
  constructor(private readonly vista: VistaClient, private readonly store: PropertySyncStore, private readonly concurrency = 2, private readonly imageHostname?: string) {}

  async addAndSync(code: string): Promise<{ created: boolean; result: SyncResult }> {
    const runId = await this.store.startRun();
    try {
      const normalized = await this.fetchNormalized(code);
      const { selection, created } = await this.store.ensureCurated(code);
      await this.store.saveSnapshot(selection.id, normalized);
      await this.store.finishRun(runId, { status: "SUCCESS", totalProcessed: 1, totalSuccess: 1, totalFailed: 0 });
      return { created, result: { code, status: "SUCCESS" } };
    } catch (error) {
      logSyncFailure(code, error);
      const result = classifyFailure(code, error);
      if (await this.store.findCuratedByCode(code)) await this.store.recordSyncFailure(code, result.message ?? result.status, new Date());
      await this.store.finishRun(runId, { status: "FAILED", totalProcessed: 1, totalSuccess: 0, totalFailed: 1, errorSummary: result.message });
      return { created: false, result };
    }
  }

  async preview(code: string): Promise<ReturnType<typeof normalizeVistaCommercialData>> {
    return this.fetchNormalized(code);
  }

  async syncOne(code: string): Promise<SyncResult> {
    const runId = await this.store.startRun();
    const result = await this.processCode(code);
    await this.store.finishRun(runId, {
      status: result.status === "SUCCESS" ? "SUCCESS" : "FAILED",
      totalProcessed: 1, totalSuccess: result.status === "SUCCESS" ? 1 : 0,
      totalFailed: result.status === "SUCCESS" ? 0 : 1, errorSummary: result.message,
    });
    return result;
  }

  async syncAll(): Promise<SyncResult[]> {
    const selections = await this.store.listCurated();
    const runId = await this.store.startRun();
    const results = await mapWithConcurrency(selections.map((item) => item.vistaCode), this.concurrency, (code) => this.processCode(code));
    const success = results.filter((result) => result.status === "SUCCESS").length;
    const failed = results.length - success;
    await this.store.finishRun(runId, {
      status: failed === 0 ? "SUCCESS" : success === 0 ? "FAILED" : "PARTIAL",
      totalProcessed: results.length, totalSuccess: success, totalFailed: failed,
      errorSummary: results.filter((result) => result.message).map((result) => `${result.code}: ${result.message}`).join("; ").slice(0, 2_000) || undefined,
    });
    return results;
  }

  private async processCode(code: string): Promise<SyncResult> {
    const selection = await this.store.findCuratedByCode(code);
    if (!selection) return { code, status: "NOT_FOUND", message: "Código não selecionado em curated_properties." };
    try {
      const normalized = await this.fetchNormalized(code);
      await this.store.saveSnapshot(selection.id, normalized);
      return { code, status: "SUCCESS" };
    } catch (error) {
      const result = classifyFailure(code, error);
      await this.store.recordSyncFailure(code, result.message ?? result.status, new Date());
      return result;
    }
  }

  private async fetchNormalized(code: string) {
    const response = await this.vista.getPropertyDetails(code, { fields: VISTA_DETAIL_FIELDS });
    const detail = extractVistaDetail(response);
    if (!detail) throw new VistaMappingError("Vista não retornou um imóvel para o código.", { kind: "NOT_FOUND" });
    // O identificador aceito por `imovel` pode ser o ID interno retornado pela
    // listagem, enquanto `Codigo` no detalhe é o código comercial da imobiliária.
    return normalizeVistaCommercialData(detail, new Date(), this.imageHostname);
  }
}

function logSyncFailure(code: string, error: unknown): void {
  const cause=error instanceof Error&&error.cause instanceof Error?toSanitizedError(error.cause):undefined;
  console.error(JSON.stringify(sanitizeForLog({level:"error",event:"property.sync.failed",propertyCode:code,error:toSanitizedError(error),...(cause?{cause}:{})})));
}

function classifyFailure(code: string, error: unknown): SyncResult {
  if (error instanceof VistaMappingError) return { code, status: error.details.kind === "NOT_FOUND" ? "NOT_FOUND" : "INVALID_RESPONSE", message: error.message };
  if (error instanceof VistaError && (error.code === "NETWORK" || error.code === "TIMEOUT" || (error.code === "HTTP" && Number(error.details.status) >= 500))) {
    return { code, status: "TEMPORARY_FAILURE", message: error.message };
  }
  if (error instanceof TypeError) return { code, status: "TEMPORARY_FAILURE", message: "Falha temporária de transporte." };
  return { code, status: "INVALID_RESPONSE", message: String(toSanitizedError(error).message ?? "Falha de sincronização") };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, operation: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await operation(items[index]); }
  }));
  return results;
}
