/**
 * Eventos de analytics (GA4) — opcionais e sem dados pessoais.
 *
 * Só há envio quando o gtag foi carregado pelo componente <Analytics/>, o que exige
 * NEXT_PUBLIC_ANALYTICS_ENABLED=true e um NEXT_PUBLIC_GA_MEASUREMENT_ID válido.
 * Parâmetros fora da lista permitida são descartados; textos com aparência de e-mail,
 * telefone ou token são removidos. Mensagens e campos de formulário nunca são enviados.
 */

export type AnalyticsEventName = "search" | "view_item" | "whatsapp_click" | "generate_lead" | "view_collection" | "web_vitals";

const ALLOWED_PARAMS = new Set([
  "purpose", "property_type", "neighborhood", "property_code", "collection",
  "lead_type", "source_page", "delivery_status",
  "metric_name", "metric_id", "metric_rating", "value", "non_interaction",
]);

const SENSITIVE_PATTERN = /@|\d{8,}|[?&](?:key|token|code|password)=|bearer\s/i;

export type AnalyticsParams = Record<string, string | number | boolean | undefined | null>;

export function sanitizeEventParams(params: AnalyticsParams = {}): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAMS.has(key) || value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim().slice(0, 100);
      if (!trimmed || (key !== "property_code" && SENSITIVE_PATTERN.test(trimmed))) continue;
      if (key === "property_code" && !/^[A-Za-z0-9-]{1,40}$/.test(trimmed)) continue;
      result[key] = trimmed;
    } else if (typeof value === "number") {
      if (Number.isFinite(value)) result[key] = Math.round(value * 1000) / 1000;
    } else result[key] = value;
  }
  return result;
}

type Gtag = (command: "event", name: string, params: Record<string, unknown>) => void;

export function trackEvent(name: AnalyticsEventName, params?: AnalyticsParams): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, sanitizeEventParams(params));
}

export function isValidMeasurementId(value: string | undefined): value is string {
  return Boolean(value && /^G-[A-Z0-9]{4,20}$/.test(value));
}
