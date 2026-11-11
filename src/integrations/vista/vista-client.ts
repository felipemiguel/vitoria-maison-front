import { VistaError, sanitizeForLog, toSanitizedError } from "./vista-errors";
import { Semaphore } from "./vista-semaphore";
import type { VistaClient, VistaDetailsOptions, VistaListOptions, VistaLogger, VistaSearch } from "./vista-types";
import type { VistaConfig } from "./vista-config";

type FetchLike = typeof fetch;
type ClientDependencies = {
  fetch?: FetchLike;
  logger?: VistaLogger;
  sleep?: (milliseconds: number) => Promise<void>;
  retries?: number;
  concurrency?: number;
};

const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
const consoleLogger: VistaLogger = {
  info: (event, details) => console.info(JSON.stringify(sanitizeForLog({ level: "info", event, ...details }))),
  warn: (event, details) => console.warn(JSON.stringify(sanitizeForLog({ level: "warn", event, ...details }))),
  error: (event, details) => console.error(JSON.stringify(sanitizeForLog({ level: "error", event, ...details }))),
};

function validateFields(fields: VistaListOptions["fields"]): void {
  if (!Array.isArray(fields) || fields.length === 0 || fields.length > 30) {
    throw new VistaError("A consulta deve informar entre 1 e 30 campos.", "VALIDATION");
  }
}

export function buildVistaUrl(config: VistaConfig, path: "imoveis/listar" | "imoveis/detalhes", search: VistaSearch, extras: Record<string, string>): URL {
  const url = new URL(path, config.baseUrl);
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("pesquisa", JSON.stringify(search));
  for (const [key, value] of Object.entries(extras)) url.searchParams.set(key, value);
  return url;
}

export class HttpVistaClient implements VistaClient {
  private readonly fetchImpl: FetchLike;
  private readonly logger: VistaLogger;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly retries: number;
  private readonly semaphore: Semaphore;

  constructor(private readonly config: VistaConfig, dependencies: ClientDependencies = {}) {
    this.fetchImpl = dependencies.fetch ?? fetch;
    this.logger = dependencies.logger ?? consoleLogger;
    this.sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.retries = dependencies.retries ?? 2;
    this.semaphore = new Semaphore(dependencies.concurrency ?? 2);
  }

  async listProperties(options: VistaListOptions): Promise<unknown> {
    validateFields(options.fields);
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 5;
    if (!Number.isInteger(page) || page < 1) throw new VistaError("Página inválida.", "VALIDATION");
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      throw new VistaError("A listagem aceita entre 1 e 50 registros por chamada.", "VALIDATION");
    }
    const url = buildVistaUrl(this.config, "imoveis/listar", {
      fields: options.fields,
      ...(options.filter && Object.keys(options.filter).length ? { filter: options.filter } : {}),
      ...(options.advFilter && Object.keys(options.advFilter).length ? { advFilter: options.advFilter } : {}),
      ...(options.order && Object.keys(options.order).length ? { order: options.order } : {}),
      paginacao: { pagina: page, quantidade: pageSize },
    }, options.showTotal === false ? {} : { showtotal: "1" });
    return this.request(url, "properties.list");
  }

  async getPropertyDetails(code: string, options: VistaDetailsOptions): Promise<unknown> {
    validateFields(options.fields);
    const normalizedCode = code.trim();
    if (!/^[\p{L}\p{N}._-]{1,80}$/u.test(normalizedCode)) {
      throw new VistaError("Código de imóvel inválido.", "VALIDATION");
    }
    const url = buildVistaUrl(this.config, "imoveis/detalhes", { fields: options.fields }, { imovel: normalizedCode });
    return this.request(url, "properties.details");
  }

  private async request(url: URL, operation: string): Promise<unknown> {
    return this.semaphore.run(async () => {
      const startedAt = Date.now();
      for (let attempt = 0; attempt <= this.retries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
          this.logger.info("vista.request.started", { operation, attempt: attempt + 1 });
          const response = await this.fetchImpl(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            redirect: "manual",
            signal: controller.signal,
          });

          if (response.status >= 300 && response.status < 400) {
            throw new VistaError("Redirect bloqueado por segurança.", "REDIRECT_BLOCKED", { status: response.status });
          }
          if (!response.ok) {
            const responseSummary = await readErrorSummary(response);
            const error = new VistaError("A API Vista respondeu com erro HTTP.", "HTTP", { status: response.status, ...(responseSummary ? { response: responseSummary } : {}) });
            if (transientStatuses.has(response.status) && attempt < this.retries) {
              this.logger.warn("vista.request.retry", { operation, attempt: attempt + 1, status: response.status });
              await this.sleep(250 * 2 ** attempt);
              continue;
            }
            throw error;
          }

          const body = await response.text();
          try {
            const parsed: unknown = JSON.parse(body);
            this.logger.info("vista.request.completed", { operation, status: response.status, durationMs: Date.now() - startedAt });
            return parsed;
          } catch (cause) {
            throw new VistaError("A API Vista retornou JSON inválido.", "INVALID_JSON", { status: response.status }, { cause });
          }
        } catch (error) {
          if (error instanceof VistaError) {
            this.logger.error("vista.request.failed", { operation, ...toSanitizedError(error) });
            throw error;
          }
          if (controller.signal.aborted) {
            const timeoutError = new VistaError("Tempo limite excedido ao consultar a API Vista.", "TIMEOUT", { timeoutMs: this.config.timeoutMs });
            this.logger.error("vista.request.failed", { operation, ...toSanitizedError(timeoutError) });
            throw timeoutError;
          }
          if (attempt < this.retries) {
            this.logger.warn("vista.request.retry", { operation, attempt: attempt + 1, reason: "network" });
            await this.sleep(250 * 2 ** attempt);
            continue;
          }
          const networkError = new VistaError("Falha de rede ao consultar a API Vista.", "NETWORK", {}, { cause: error });
          this.logger.error("vista.request.failed", { operation, ...toSanitizedError(networkError) });
          throw networkError;
        } finally {
          clearTimeout(timeout);
        }
      }
      throw new VistaError("Falha inesperada ao consultar a API Vista.", "NETWORK");
    });
  }
}

async function readErrorSummary(response: Response): Promise<unknown> {
  try {
    const body = (await response.text()).slice(0, 1_000);
    if (!body) return undefined;
    try { return sanitizeForLog(JSON.parse(body)); }
    catch { return sanitizeForLog(body.replace(/\s+/g, " ").trim()); }
  } catch { return undefined; }
}
