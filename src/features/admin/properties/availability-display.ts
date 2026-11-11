import type { AdminPropertySummary } from "./types";

export type AdminAvailabilityDisplay = "AVAILABLE" | "MANUAL_CONFIRMED" | "UNKNOWN" | "EXPIRED" | "UNAVAILABLE";

export function availabilityDisplay(property: Pick<AdminPropertySummary, "availabilityStatus" | "availabilityExpiresAt">, now = new Date()): AdminAvailabilityDisplay {
  if (property.availabilityStatus === "UNAVAILABLE") return "UNAVAILABLE";
  if (property.availabilityStatus === "AVAILABLE") return "AVAILABLE";
  if (!property.availabilityExpiresAt) return "UNKNOWN";
  return property.availabilityExpiresAt.getTime() > now.getTime() ? "MANUAL_CONFIRMED" : "EXPIRED";
}

export function availabilityLabel(value: AdminAvailabilityDisplay): string {
  return ({ AVAILABLE: "Disponível no Vista", MANUAL_CONFIRMED: "Confirmada manualmente", UNKNOWN: "Desconhecida", EXPIRED: "Confirmação expirada", UNAVAILABLE: "Indisponível" })[value];
}
