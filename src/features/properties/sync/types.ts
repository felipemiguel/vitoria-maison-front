import type { PropertyCommercialData } from "../types";

export type CuratedSelection = { id: string; vistaCode: string; slug: string; published: boolean };
export type SyncResult = { code: string; status: "SUCCESS" | "TEMPORARY_FAILURE" | "INVALID_RESPONSE" | "NOT_FOUND"; message?: string };
export type SyncRunSummary = { id: string; status: string; startedAt: Date; finishedAt: Date | null; totalProcessed: number; totalSuccess: number; totalFailed: number; errorSummary: string | null };

export interface PropertySyncStore {
  ensureCurated(code: string): Promise<{ selection: CuratedSelection; created: boolean }>;
  findCuratedByCode(code: string): Promise<CuratedSelection | null>;
  listCurated(): Promise<CuratedSelection[]>;
  saveSnapshot(curatedPropertyId: string, data: PropertyCommercialData): Promise<void>;
  recordSyncFailure(code: string, message: string, attemptedAt: Date): Promise<void>;
  startRun(): Promise<string>;
  finishRun(id: string, result: { status: "SUCCESS" | "PARTIAL" | "FAILED"; totalProcessed: number; totalSuccess: number; totalFailed: number; errorSummary?: string }): Promise<void>;
  listRuns(limit?: number): Promise<SyncRunSummary[]>;
}
