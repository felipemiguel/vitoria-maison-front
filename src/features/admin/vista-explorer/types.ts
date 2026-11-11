import type { AvailabilityStatus, PropertyCommercialData } from "@/features/properties/types";

export type VistaExplorerFilters = {
  code?: string;
  city?: string;
  neighborhood?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  onlyNotImported: boolean;
  page: number;
  pageSize: 10 | 20 | 50;
  view: "cards" | "list";
};

export type VistaImportStatus =
  | { kind: "NOT_IMPORTED" }
  | { kind: "DRAFT" | "PUBLISHED" | "BLOCKED"; id: string };

export type VistaExplorerItem = {
  code: string;
  category: string | null;
  city: string | null;
  neighborhood: string | null;
  salePrice: number | null;
  rentalPrice: number | null;
  privateArea: number | null;
  totalArea: number | null;
  bedrooms: number | null;
  suites: number | null;
  parkingSpaces: number | null;
  coverImageUrl: string | null;
  availabilityStatus: AvailabilityStatus;
  importStatus: VistaImportStatus;
};

export type VistaExplorerPage = {
  items: VistaExplorerItem[];
  total: number;
  pages: number;
  page: number;
  pageSize: number;
};

export type VistaExplorerPreview = PropertyCommercialData & { imported: VistaImportStatus };

export type BulkImportItemResult = {
  code: string;
  status: "IMPORTED" | "EXISTING" | "FAILED";
  id?: string;
  message?: string;
};

export type BulkImportResult = {
  batchId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  total: number;
  imported: number;
  existing: number;
  failed: number;
  items: BulkImportItemResult[];
};
