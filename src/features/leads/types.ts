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
};

export type LeadDeliveryResult = {
  status: Exclude<LeadDeliveryStatus,"PENDING">;
  reference?: string;
  errorCode?: string;
};

export interface LeadProvider { sendLead(lead:ResolvedLead):Promise<LeadDeliveryResult> }

export type LeadSubmissionResult = {
  id: string;
  status: LeadDeliveryStatus;
  message: string;
};
