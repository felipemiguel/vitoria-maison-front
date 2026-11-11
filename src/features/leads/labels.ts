import type { LeadAssignmentStatus, LeadDeliveryStatus, LeadSource, LeadType } from "./types";

export const LEAD_TYPE_LABELS: Record<LeadType, string> = { PROPERTY_INTEREST: "Interesse em imóvel", GENERAL_CONTACT: "Contato geral", OWNER_CONTACT: "Proprietário", INVESTMENT_CONSULTING: "Investimentos" };
export const LEAD_DELIVERY_LABELS: Record<LeadDeliveryStatus, string> = { PENDING: "Pendente", DELIVERED: "Entregue ao Vista", MOCKED: "Teste (não enviado)", FAILED: "Falhou", UNKNOWN: "Indeterminado" };
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = { MAISON_SITE: "Site Vitória Maison", BROKER_SITE: "Site de corretor" };
/** Linguagem cuidadosa: "não verificada" nunca é apresentada como confirmada. */
export const LEAD_ASSIGNMENT_LABELS: Record<LeadAssignmentStatus, string> = { NOT_APPLICABLE: "Não se aplica", PENDING: "Aguardando entrega", CONFIRMED: "Confirmada no Vista", MISMATCH: "Divergente", UNVERIFIED: "Não verificada" };
export const LEAD_ASSIGNMENT_HELP: Record<LeadAssignmentStatus, string> = {
  NOT_APPLICABLE: "Lead do site institucional.",
  PENDING: "A atribuição só pode ser conferida depois da entrega ao Vista.",
  CONFIRMED: "O Vista informou (ou a equipe conferiu) que o lead está com o corretor do site.",
  MISMATCH: "No Vista, o lead está com outro corretor (por exemplo, cliente já vinculado). Nada é alterado automaticamente.",
  UNVERIFIED: "O lead é seu na Vitória Maison, mas a distribuição no Vista ainda não foi conferida.",
};
export function deliveryBadgeClass(value: LeadDeliveryStatus) { return value === "DELIVERED" ? "bg-emerald-100 text-emerald-800" : value === "FAILED" ? "bg-red-100 text-red-800" : value === "UNKNOWN" ? "bg-amber-100 text-amber-900" : "bg-[#eee7e1] text-[#625a55]"; }
export function assignmentBadgeClass(value: LeadAssignmentStatus) { return value === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : value === "MISMATCH" ? "bg-red-100 text-red-800" : value === "UNVERIFIED" ? "bg-amber-100 text-amber-900" : "bg-[#eee7e1] text-[#625a55]"; }
