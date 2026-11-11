"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthorizedAdminServices } from "@/features/admin/properties/admin-property-service-factory";
import { enforceAdminVistaRateLimit } from "@/features/admin/auth/admin-operation-rate-limit";
import type { BulkImportResult, VistaExplorerPreview } from "@/features/admin/vista-explorer/types";
import { publicVistaExplorerError } from "@/features/admin/vista-explorer/public-error";

const codeSchema = z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N}._-]+$/u);
export type BulkImportActionState = { result?: BulkImportResult; error?: string };

export async function previewVistaPropertyAction(code: string): Promise<{ property?: VistaExplorerPreview; error?: string }> {
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { error: "Código Vista inválido." };
  try {
    const { admin, vistaExplorer } = await getAuthorizedAdminServices("properties:read");
    await enforceAdminVistaRateLimit(admin.id);
    return { property: await vistaExplorer.preview(parsed.data) };
  } catch (error) { return { error: publicVistaExplorerError(error) }; }
}

export async function bulkImportPropertiesAction(_previous: BulkImportActionState, formData: FormData): Promise<BulkImportActionState> {
  try {
    const codesValue = formData.get("codes");
    const codes = typeof codesValue === "string" ? JSON.parse(codesValue) : null;
    const idempotencyKey = formData.get("idempotencyKey");
    const { admin, bulkImport } = await getAuthorizedAdminServices("properties:import");
    await enforceAdminVistaRateLimit(admin.id);
    const result = await bulkImport.execute({ codes, idempotencyKey }, admin.id);
    revalidatePath("/admin/vista");
    revalidatePath("/admin/imoveis");
    return { result };
  } catch (error) { return { error: publicVistaExplorerError(error) }; }
}

