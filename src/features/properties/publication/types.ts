import type { AvailabilityStatus, PropertyPurpose, PropertyType } from "../types";

export type PublicationDecision = { allowed: boolean; reasons: string[] };

export type PublicationSnapshot = {
  syncStatus: "SUCCESS";
  availabilityStatus: AvailabilityStatus;
  fetchedAt: Date;
  salePrice: string | null;
  rentalPrice: string | null;
  privateArea: string | null;
  category: string | null;
  coverImageUrl: string | null;
};

export type PublicationRecord = {
  id: string;
  vistaCode: string;
  updatedAt: Date;
  publicationVersion: number;
  published: boolean;
  publicationPurpose: PropertyPurpose | null;
  editorialTitle: string | null;
  sourceTitle: string | null;
  editorialCoverUrl: string | null;
  availabilityConfirmedAt: Date | null;
  availabilityExpiresAt: Date | null;
  availabilityConfirmedBy: string | null;
  availabilityConfirmationSource: string | null;
  snapshot: PublicationSnapshot | null;
};

export type ManualAvailabilityConfirmation = {
  confirmedAt: Date;
  expiresAt: Date;
  confirmedBy: string;
  source: "MANUAL_CLI" | "MANUAL_ADMIN";
};

export const supportedPublicationTypes: readonly PropertyType[] = ["APARTMENT", "FLAT", "STUDIO", "PENTHOUSE"];

export interface PropertyPublicationStore {
  load(code: string): Promise<PublicationRecord | null>;
  confirmAvailability(code: string, expectedVersion: number, confirmation: ManualAvailabilityConfirmation): Promise<boolean>;
  clearAvailabilityConfirmation(code: string, expectedVersion: number, actor: string, changedAt: Date): Promise<boolean>;
  setPublished(code: string, published: boolean, expectedVersion: number, actor: string, details?: Record<string, unknown>): Promise<boolean>;
}
