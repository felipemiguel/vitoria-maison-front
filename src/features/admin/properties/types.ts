import type { AvailabilityStatus, PropertyCommercialData, PropertyPurpose } from "@/features/properties/types";
import type { PropertyPublicationStatus } from "@/features/properties/publication/property-publication-service";

export type AdminPropertyFilters = {
  search?: string;
  neighborhood?: string;
  publication?: "PUBLISHED" | "DRAFT";
  availability?: AvailabilityStatus | "EXPIRED";
  syncStatus?: "NEVER" | "SUCCESS" | "FAILED";
  featured?: boolean;
  sort?: "newest" | "code" | "title" | "last-sync" | "featured";
  page: number;
  pageSize: number;
};

export type AdminPropertySummary = {
  id: string; vistaCode: string; publicationVersion: number; title: string; neighborhood: string | null; city: string | null;
  coverImageUrl: string | null; salePrice: string | null; rentalPrice: string | null;
  publicationPurpose: PropertyPurpose | null; published: boolean; publiclyEligible: boolean;
  availabilityStatus: AvailabilityStatus; availabilityExpiresAt: Date | null;
  lastSyncStatus: string; lastSyncAttemptAt: Date | null;
};

export type AdminPropertyPage = { items: AdminPropertySummary[]; total: number; page: number; pageSize: number; pages: number };

export type AdminDashboardStats = {
  selected: number; published: number; drafts: number; publiclyEligible: number;
  availabilityAttention: number; syncErrors: number;
  latestSync: { status: string; startedAt: Date; finishedAt: Date | null } | null;
  latestProperties: AdminPropertySummary[];
  latestSyncRuns: { id: string; status: string; startedAt: Date; finishedAt: Date | null; totalProcessed: number; totalSuccess: number; totalFailed: number }[];
};

export type AdminPropertyDetails = AdminPropertySummary & {
  sourceTitle: string | null; sourceDescription: string | null;
  featured: boolean; featuredOrder: number | null; editorialTitle: string | null; editorialDescription: string | null;
  rawCategory: string | null; privateArea: string | null; totalArea: string | null;
  bedrooms: number | null; suites: number | null; parkingSpaces: number | null;
  characteristics: unknown; infrastructure: unknown; sourcePurpose: string | null; sourceUpdatedAt: Date | null;
  availabilityConfirmedAt: Date | null; availabilityConfirmedBy: string | null;
  lastSyncError: string | null; collections: { slug: string; name: string }[];
  publicationStatus: PropertyPublicationStatus;
};

export type VistaPropertyPreview = Pick<PropertyCommercialData,
  "externalCode" | "rawCategory" | "city" | "neighborhood" | "salePrice" | "rentalPrice" |
  "privateArea" | "totalArea" | "bedrooms" | "suites" | "parkingSpaces" | "coverImageUrl"
>;
export type VistaPropertyPreviewResult = { status: "READY"; property: VistaPropertyPreview } | { status: "DUPLICATE"; id: string; vistaCode: string };

export type ImportResult = { status: "IMPORTED" | "DUPLICATE"; id: string; vistaCode: string };
