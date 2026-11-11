import type { LeadAssignmentStatus, LeadSource } from "@/database/schema";
export type { LeadAssignmentStatus, LeadSource };

/**
 * Origem do lead, decidida no SERVIDOR (hostname validado + site publicado). Nunca vem do navegador.
 * Para sites de corretor, o corretor é o dono do site no momento do envio.
 */
export type LeadOrigin =
  | { source: "MAISON_SITE"; hostname: string | null; path: string }
  | { source: "BROKER_SITE"; hostname: string; path: string; brokerSiteId: string; brokerUserId: string; subdomain: string; vistaBrokerCode: string | null };

export type LeadType = "PROPERTY_INTEREST" | "GENERAL_CONTACT" | "OWNER_CONTACT" | "INVESTMENT_CONSULTING";
export type LeadDeliveryStatus = "PENDING" | "DELIVERED" | "MOCKED" | "FAILED" | "UNKNOWN";

export type LeadInput = {
  type: LeadType;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  propertyId?: string;
  vehicle?: string;
  sourcePage: string;
  submissionKey: string;
};

export type ResolvedLead = Omit<LeadInput,"propertyId"|"submissionKey"> & {
  id: string;
  propertyId: string|null;
  propertyVistaCode: string|null;
  vistaVehicle: string;
  /** Código Vista do corretor do site de origem (somente sites de corretor). O provider decide se envia. */
  vistaBrokerCode?: string|null;
};

export type LeadDeliveryResult = {
  status: Exclude<LeadDeliveryStatus,"PENDING">;
  reference?: string;
  /** Corretor informado na resposta do Vista (campo "Corretor"). Não comprova escolha do destinatário. */
  brokerCode?: string;
  errorCode?: string;
};

export interface LeadProvider { sendLead(lead:ResolvedLead):Promise<LeadDeliveryResult> }

export type LeadSubmissionResult = {
  id: string;
  status: LeadDeliveryStatus;
  message: string;
};
