import type { AdminPropertySummary } from "./types";

export type AdminAvailabilityDisplay = "AVAILABLE" | "MANUAL_CONFIRMED" | "UNKNOWN" | "UNAVAILABLE";

export function availabilityDisplay(property: Pick<AdminPropertySummary, "availabilityStatus" | "availabilityConfirmedAt">): AdminAvailabilityDisplay {
  if (property.availabilityStatus === "UNAVAILABLE") return "UNAVAILABLE";
  if (property.availabilityStatus === "AVAILABLE") return "AVAILABLE";
  return property.availabilityConfirmedAt ? "MANUAL_CONFIRMED" : "UNKNOWN";
}

export function availabilityLabel(value: AdminAvailabilityDisplay): string {
  return ({ AVAILABLE: "Disponível no Vista", MANUAL_CONFIRMED: "Disponibilidade confirmada", UNKNOWN: "Não confirmada", UNAVAILABLE: "Indisponível" })[value];
}
