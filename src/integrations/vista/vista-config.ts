import { VistaError } from "./vista-errors";

export type VistaConfig = {
  baseUrl: URL;
  apiKey: string;
  timeoutMs: number;
  enabled: boolean;
};

const blockedHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function parseVistaConfig(env: NodeJS.ProcessEnv = process.env): VistaConfig {
  const enabled = env.VISTA_POC_ENABLED === "true";
  const rawBaseUrl = env.VISTA_API_BASE_URL?.trim() ?? "";
  const apiKey = env.VISTA_API_KEY?.trim() ?? "";
  const timeoutMs = Number(env.VISTA_API_TIMEOUT_MS ?? "15000");

  if (!enabled) throw new VistaError("PoC Vista desabilitada. Defina VISTA_POC_ENABLED=true para executar diagnósticos.", "CONFIGURATION");
  if (!rawBaseUrl) throw new VistaError("VISTA_API_BASE_URL não configurada.", "CONFIGURATION");
  if (!apiKey) throw new VistaError("VISTA_API_KEY não configurada.", "CONFIGURATION");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
    throw new VistaError("VISTA_API_TIMEOUT_MS deve ser um inteiro entre 1000 e 60000.", "CONFIGURATION");
  }

  let baseUrl: URL;
  try { baseUrl = new URL(rawBaseUrl); }
  catch { throw new VistaError("VISTA_API_BASE_URL inválida.", "CONFIGURATION"); }

  if (baseUrl.protocol !== "https:") throw new VistaError("VISTA_API_BASE_URL deve usar HTTPS.", "CONFIGURATION");
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new VistaError("VISTA_API_BASE_URL não pode conter credenciais, query ou fragmento.", "CONFIGURATION");
  }
  if (blockedHosts.has(baseUrl.hostname.toLowerCase()) || !baseUrl.hostname.includes(".")) {
    throw new VistaError("VISTA_API_BASE_URL deve apontar para um host HTTPS público válido.", "CONFIGURATION");
  }
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/`;

  return { baseUrl, apiKey, timeoutMs, enabled };
}
