import type { VistaClient, VistaListOptions, VistaLogger } from "../../src/integrations/vista/vista-types";
import { VistaError, toSanitizedError } from "../../src/integrations/vista/vista-errors";
import { VISTA_CONNECTION_FIELDS, VISTA_DETAIL_FIELDS, VISTA_LIST_FIELDS } from "../../src/integrations/vista/vista-fields";
import { extractVistaDetail, extractVistaPagination, extractVistaRecords } from "../../src/integrations/vista/vista-response";

export type FieldEvidence =
  | { state: "ABSENT" }
  | { state: "NULL" }
  | { state: "VALUE"; value: string | number | boolean }
  | { state: "COMPLEX"; valueType: "array" | "object" };

export type VisibilityScenario = {
  id: "CURRENT_LIST" | "INTERNAL_LIST" | "SUSPENDED_LIST" | "EXPANDED_LIST" | "DIRECT_DETAILS" | "EXPANDED_DETAILS" | "MINIMAL_EXPANDED_LIST";
  label: string;
  endpoint: "/imoveis/listar" | "/imoveis/detalhes";
  httpStatus: number | null;
  found: boolean | null;
  observation: string;
  request: Record<string, unknown>;
  recordsReceived: number;
  total: number | null;
  receivedFields: string[];
  returnedCodes: string[];
  error?: Record<string, unknown>;
};

export type VisibilityReport = {
  schemaVersion: 2;
  generatedAt: string;
  code: string;
  readOnly: true;
  applicationInspection: {
    explicitPublicationFilter: false;
    productionFilters: string[];
    note: string;
  };
  scenarios: VisibilityScenario[];
  evidence: {
    finalidade: FieldEvidence;
    valorVenda: FieldEvidence;
    valorLocacao: FieldEvidence;
    availability: { state: "NOT_CONFIRMED"; note: string };
    publication: { state: "NOT_ACCESSIBLE"; note: string };
  };
  classification: { code: "A" | "B" | "C" | "D"; title: string; justification: string };
  comparison?: { baselineGeneratedAt: string; differences: string[] };
};

export class DiagnosticVistaLogger implements VistaLogger {
  private status: number | null = null;

  reset(): void { this.status = null; }
  currentStatus(): number | null { return this.status; }
  info(event: string, details: Record<string, unknown>): void {
    if (event === "vista.request.completed" && typeof details.status === "number") this.status = details.status;
  }
  warn(): void {}
  error(event: string, details: Record<string, unknown>): void {
    if (event !== "vista.request.failed") return;
    const nested = isRecord(details.details) ? details.details : undefined;
    if (typeof nested?.status === "number") this.status = nested.status;
  }
}

export async function runVisibilityProbe(client: VistaClient, logger: DiagnosticVistaLogger, code: string, now = new Date()): Promise<VisibilityReport> {
  const currentOptions: VistaListOptions = {
    fields: VISTA_LIST_FIELDS,
    filter: { Codigo: code },
    order: { Codigo: "asc" },
    page: 1,
    pageSize: 20,
    showTotal: true,
  };
  const scenarios = [
    await runListScenario(client, logger, "CURRENT_LIST", "Listagem atual", code, currentOptions,
      "Replica a consulta do painel /admin/vista quando o filtro por código é preenchido."),
    await runListScenario(client, logger, "INTERNAL_LIST", "Listagem com internos", code, { ...currentOptions, showInternal: true },
      "Adiciona somente showInternal=1, conforme orientação do suporte Vista."),
    await runListScenario(client, logger, "SUSPENDED_LIST", "Listagem com suspensos", code, { ...currentOptions, showSuspended: true },
      "Adiciona somente showSuspended=1, conforme orientação do suporte Vista."),
    await runListScenario(client, logger, "EXPANDED_LIST", "Listagem ampliada", code, { ...currentOptions, showInternal: true, showSuspended: true },
      "Adiciona showInternal=1 e showSuspended=1, mantendo os demais parâmetros do painel."),
    await runDetailsScenario(client, logger, "DIRECT_DETAILS", "Consulta direta", code, false),
    await runDetailsScenario(client, logger, "EXPANDED_DETAILS", "Consulta direta ampliada", code, true),
    await runListScenario(client, logger, "MINIMAL_EXPANDED_LIST", "Listagem mínima ampliada", code, {
      fields: VISTA_CONNECTION_FIELDS,
      filter: { Codigo: code },
      page: 1,
      pageSize: 20,
      showTotal: true,
      showInternal: true,
      showSuspended: true,
    }, "Usa somente Codigo, filtro exato, paginação, showtotal=1, showInternal=1 e showSuspended=1."),
  ];
  const details = scenarios.find((scenario) => scenario.id === "EXPANDED_DETAILS" && scenario.found)
    ?? scenarios.find((scenario) => scenario.id === "DIRECT_DETAILS");
  const detailRecord = details && "record" in details ? (details as VisibilityScenario & { record?: Record<string, unknown> }).record : undefined;
  const report: VisibilityReport = {
    schemaVersion: 2,
    generatedAt: now.toISOString(),
    code,
    readOnly: true,
    applicationInspection: {
      explicitPublicationFilter: false,
      productionFilters: ["Codigo", "Cidade", "Bairro", "Categoria", "Dormitorios", "ValorVenda/ValorLocacao (quando informados no painel)"],
      note: "Nenhum filtro explícito de publicação, exibição no site, status comercial, finalidade ou disponibilidade é enviado pelo painel atual.",
    },
    scenarios: scenarios.map(stripPrivateRecord),
    evidence: {
      finalidade: fieldEvidence(detailRecord, "Finalidade"),
      valorVenda: fieldEvidence(detailRecord, "ValorVenda"),
      valorLocacao: fieldEvidence(detailRecord, "ValorLocacao"),
      availability: { state: "NOT_CONFIRMED", note: "Nenhum campo inequívoco de disponibilidade foi confirmado para esta integração." },
      publication: { state: "NOT_ACCESSIBLE", note: "Nenhum campo de publicação foi confirmado ou solicitado; ausência não é convertida em false." },
    },
    classification: classifyVisibility(scenarios),
  };
  return report;
}

async function runListScenario(
  client: VistaClient,
  logger: DiagnosticVistaLogger,
  id: "CURRENT_LIST" | "INTERNAL_LIST" | "SUSPENDED_LIST" | "EXPANDED_LIST" | "MINIMAL_EXPANDED_LIST",
  label: string,
  code: string,
  options: VistaListOptions,
  baseObservation: string,
): Promise<VisibilityScenario> {
  logger.reset();
  const request = describeListRequest(options);
  try {
    const payload = await client.listProperties(options);
    const records = extractVistaRecords(payload);
    const exact = records.some((record) => String(record.Codigo ?? "").trim() === code);
    const found = exact ? true : records.length === 0 ? false : null;
    const pagination = extractVistaPagination(payload, { page: options.page ?? 1, pageSize: options.pageSize ?? 5, records: records.length });
    return {
      id, label, endpoint: "/imoveis/listar", httpStatus: logger.currentStatus(), found,
      observation: found === null ? `${baseObservation} A API retornou registro(s), mas nenhum com Codigo idêntico; resultado inconclusivo.` : baseObservation,
      request, recordsReceived: records.length, total: pagination.total,
      receivedFields: unionFields(records), returnedCodes: returnedCodes(records),
    };
  } catch (error) {
    return failedScenario(id, label, "/imoveis/listar", request, logger, error);
  }
}

async function runDetailsScenario(client: VistaClient, logger: DiagnosticVistaLogger, id: "DIRECT_DETAILS" | "EXPANDED_DETAILS", label: string, code: string, expanded: boolean): Promise<VisibilityScenario & { record?: Record<string, unknown> }> {
  logger.reset();
  const options = { fields: VISTA_DETAIL_FIELDS, ...(expanded ? { showInternal: true, showSuspended: true } : {}) };
  const request = { fields: [...VISTA_DETAIL_FIELDS], imovel: code, ...(expanded ? { showInternal: 1, showSuspended: 1 } : {}) };
  try {
    const payload = await client.getPropertyDetails(code, options);
    const record = extractVistaDetail(payload) ?? undefined;
    return {
      id, label, endpoint: "/imoveis/detalhes",
      httpStatus: logger.currentStatus(), found: Boolean(record),
      observation: record
        ? "O endpoint direto retornou um imóvel. Codigo pode ser o código comercial e diferir do identificador aceito em imovel."
        : "HTTP concluído, mas nenhum registro de imóvel foi identificado na resposta.",
      request, recordsReceived: record ? 1 : 0, total: record ? 1 : 0,
      receivedFields: record ? Object.keys(record).sort() : [], returnedCodes: record ? returnedCodes([record]) : [], record,
    };
  } catch (error) {
    return failedScenario(id, label, "/imoveis/detalhes", request, logger, error);
  }
}

function failedScenario(
  id: VisibilityScenario["id"],
  label: string,
  endpoint: VisibilityScenario["endpoint"],
  request: Record<string, unknown>,
  logger: DiagnosticVistaLogger,
  error: unknown,
): VisibilityScenario {
  const status = logger.currentStatus() ?? httpStatusFromError(error);
  return {
    id, label, endpoint, httpStatus: status, found: null,
    observation: status ? `Requisição rejeitada com HTTP ${status}.` : "Requisição não concluída; consulte o erro sanitizado.",
    request, recordsReceived: 0, total: null, receivedFields: [], returnedCodes: [], error: toSanitizedError(error),
  };
}

function describeListRequest(options: VistaListOptions): Record<string, unknown> {
  return {
    fields: [...options.fields],
    ...(options.filter ? { filter: options.filter } : {}),
    ...(options.advFilter ? { advFilter: options.advFilter } : {}),
    ...(options.order ? { order: options.order } : {}),
    paginacao: { pagina: options.page ?? 1, quantidade: options.pageSize ?? 5 },
    showtotal: options.showTotal === false ? 0 : 1,
    ...(options.showInternal ? { showInternal: 1 } : {}),
    ...(options.showSuspended ? { showSuspended: 1 } : {}),
  };
}

export function classifyVisibility(scenarios: Array<Pick<VisibilityScenario, "id" | "found" | "httpStatus">>): VisibilityReport["classification"] {
  const current = scenarios.find((item) => item.id === "CURRENT_LIST");
  const expanded = scenarios.find((item) => item.id === "EXPANDED_LIST");
  const direct = scenarios.find((item) => item.id === "DIRECT_DETAILS");
  const expandedDetails = scenarios.find((item) => item.id === "EXPANDED_DETAILS");
  if (current?.found === false && expanded?.found === true && expandedDetails?.found === true) {
    return { code: "B", title: "Restrição ou comportamento confirmado da API Vista", justification: "O imóvel não aparece na consulta atual, mas aparece na listagem e nos detalhes quando showInternal=1 e showSuspended=1 são enviados." };
  }
  if (current?.found === false && expanded?.found === true && expandedDetails?.found !== true) {
    return { code: "D", title: "Resultado parcialmente conclusivo", justification: "Os parâmetros ampliam a listagem, mas o detalhe ainda não retorna o imóvel; a importação e a sincronização não são seguras ainda." };
  }
  if (direct?.found === true && current?.found === true) {
    return { code: "D", title: "Resultado inconclusivo", justification: "O imóvel está visível tanto na listagem quanto nos detalhes; este estado não reproduz a ausência investigada. Repita após a alteração manual controlada no Vista." };
  }
  if (scenarios.some((item) => item.found === null || (item.httpStatus !== null && item.httpStatus >= 400))) {
    return { code: "D", title: "Resultado inconclusivo", justification: "Ao menos uma requisição foi rejeitada, falhou ou retornou identificação ambígua." };
  }
  return { code: "D", title: "Resultado inconclusivo", justification: "As respostas não permitem atribuir a ausência a um filtro local ou a uma restrição da API." };
}

export function compareVisibilityReports(baseline: VisibilityReport, current: VisibilityReport): string[] {
  const differences: string[] = [];
  for (const scenario of current.scenarios) {
    const before = baseline.scenarios.find((item) => item.id === scenario.id);
    if (!before) { differences.push(`${scenario.label}: cenário ausente no baseline.`); continue; }
    if (before.httpStatus !== scenario.httpStatus) differences.push(`${scenario.label}: HTTP ${display(before.httpStatus)} → ${display(scenario.httpStatus)}.`);
    if (before.found !== scenario.found) differences.push(`${scenario.label}: encontrado ${foundLabel(before.found)} → ${foundLabel(scenario.found)}.`);
    if (before.total !== scenario.total) differences.push(`${scenario.label}: total ${display(before.total)} → ${display(scenario.total)}.`);
    if (before.returnedCodes.join(",") !== scenario.returnedCodes.join(",")) differences.push(`${scenario.label}: códigos retornados mudaram.`);
  }
  for (const key of ["finalidade", "valorVenda", "valorLocacao"] as const) {
    if (JSON.stringify(baseline.evidence[key]) !== JSON.stringify(current.evidence[key])) differences.push(`Campo ${key}: valor/estado mudou.`);
  }
  return differences;
}

export function classifyVisibilityComparison(baseline: VisibilityReport, current: VisibilityReport): VisibilityReport["classification"] | null {
  const beforeList = baseline.scenarios.find((item) => item.id === "CURRENT_LIST");
  const afterList = current.scenarios.find((item) => item.id === "CURRENT_LIST");
  const beforeDirect = baseline.scenarios.find((item) => item.id === "EXPANDED_DETAILS") ?? baseline.scenarios.find((item) => item.id === "DIRECT_DETAILS");
  const afterDirect = current.scenarios.find((item) => item.id === "EXPANDED_DETAILS") ?? current.scenarios.find((item) => item.id === "DIRECT_DETAILS");
  if (beforeList?.found !== afterList?.found && typeof beforeList?.found === "boolean" && typeof afterList?.found === "boolean"
    && beforeDirect?.found === true && afterDirect?.found === true) {
    return {
      code: "B",
      title: "Restrição ou comportamento da API Vista",
      justification: "Com a consulta da aplicação inalterada, a presença na listagem mudou após a alteração manual no Vista, enquanto o endpoint de detalhes continuou encontrando o imóvel.",
    };
  }
  return null;
}

export function formatVisibilityReport(report: VisibilityReport): string {
  const lines = [
    "# Diagnóstico de visibilidade Vista CRM",
    "",
    `- Código consultado: \`${report.code}\``,
    `- Gerado em: ${report.generatedAt}`,
    "- Operação: somente leitura; nenhum dado foi importado, publicado ou alterado.",
    "",
    "| Consulta | HTTP | Imóvel encontrado | Observação |",
    "|---|---:|---|---|",
    ...report.scenarios.map((item) => `| ${item.label} | ${display(item.httpStatus)} | ${foundLabel(item.found)} | ${escapeTable(item.observation)} |`),
    "",
    "## Consultas sanitizadas",
    "",
    ...report.scenarios.flatMap((item) => [`### ${item.label}`, "", "```json", JSON.stringify(item.request, null, 2), "```", ""]),
    "## Evidências",
    "",
    `- Campos recebidos por cenário: ${report.scenarios.map((item) => `${item.label}=[${item.receivedFields.join(", ") || "nenhum"}]`).join("; ")}.`,
    `- Finalidade: ${formatFieldEvidence(report.evidence.finalidade)}.`,
    `- ValorVenda: ${formatFieldEvidence(report.evidence.valorVenda)}.`,
    `- ValorLocacao: ${formatFieldEvidence(report.evidence.valorLocacao)}.`,
    `- Disponibilidade: ${report.evidence.availability.state} — ${report.evidence.availability.note}`,
    `- Publicação: ${report.evidence.publication.state} — ${report.evidence.publication.note}`,
    "",
    "## Classificação",
    "",
    `**${report.classification.code}. ${report.classification.title}.** ${report.classification.justification}`,
  ];
  if (report.comparison) lines.push(
    "", "## Comparação com baseline", "",
    `- Baseline: ${report.comparison.baselineGeneratedAt}`,
    ...(report.comparison.differences.length ? report.comparison.differences.map((item) => `- ${item}`) : ["- Nenhuma diferença observável nos campos comparados."]),
  );
  return `${lines.join("\n")}\n`;
}

function fieldEvidence(record: Record<string, unknown> | undefined, key: string): FieldEvidence {
  if (!record || !(key in record)) return { state: "ABSENT" };
  const value = record[key];
  if (value === null || value === undefined) return { state: "NULL" };
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return { state: "VALUE", value };
  return { state: "COMPLEX", valueType: Array.isArray(value) ? "array" : "object" };
}

function unionFields(records: Record<string, unknown>[]): string[] { return [...new Set(records.flatMap(Object.keys))].sort(); }
function returnedCodes(records: Record<string, unknown>[]): string[] { return [...new Set(records.flatMap((record) => record.Codigo === undefined ? [] : [String(record.Codigo)]))]; }
function stripPrivateRecord(scenario: VisibilityScenario & { record?: Record<string, unknown> }): VisibilityScenario {
  const safe = { ...scenario };
  delete safe.record;
  return safe;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function httpStatusFromError(error: unknown): number | null { return error instanceof VistaError && typeof error.details.status === "number" ? error.details.status : null; }
function foundLabel(value: boolean | null): string { return value === true ? "Sim" : value === false ? "Não" : "Inconclusivo"; }
function display(value: unknown): string { return value === null || value === undefined ? "—" : String(value); }
function escapeTable(value: string): string { return value.replaceAll("|", "\\|").replaceAll("\n", " "); }
function formatFieldEvidence(evidence: FieldEvidence): string { if (evidence.state === "VALUE") return `VALUE (${JSON.stringify(evidence.value)})`;if (evidence.state === "COMPLEX") return `COMPLEX (${evidence.valueType})`;return evidence.state; }
