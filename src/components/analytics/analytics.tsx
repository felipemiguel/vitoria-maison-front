import { isValidMeasurementId } from "@/features/analytics/events";
import { GoogleAnalytics } from "./google-analytics";

/**
 * Carrega o GA4 apenas quando habilitado explicitamente. Nenhum script de rastreamento é
 * incluído por padrão. Antes de habilitar em produção, aprove a política de privacidade e
 * implemente o registro de consentimento (LGPD); o Consent Mode inicia com armazenamento negado.
 */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true" || !isValidMeasurementId(id)) return null;
  return <GoogleAnalytics measurementId={id}/>;
}
