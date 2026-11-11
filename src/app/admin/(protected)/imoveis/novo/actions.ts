"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthorizedAdminPropertyService } from "@/features/admin/properties/admin-property-service-factory";
import type { VistaPropertyPreviewResult } from "@/features/admin/properties/types";
import { VistaError } from "@/integrations/vista/vista-errors";
import { requirePermission } from "@/features/access/server";
import { AuthenticationRequiredError, ForbiddenError } from "@/features/access/errors";
import { AdminOperationRateLimitError, enforceAdminVistaRateLimit } from "@/features/admin/auth/admin-operation-rate-limit";

const codeSchema = z.string().trim().min(1,"Informe o código Vista.").max(80).regex(/^[\p{L}\p{N}._-]+$/u,"Código Vista inválido.");
export type PreviewState = { result?: VistaPropertyPreviewResult; code?: string; error?: string };

export async function previewPropertyAction(_previous: PreviewState, formData: FormData): Promise<PreviewState> {
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Código inválido." };
  try { const admin=await requirePermission("properties:import");await enforceAdminVistaRateLimit(admin.id);return { code: parsed.data, result: await (await getAuthorizedAdminPropertyService("properties:import")).previewVistaProperty(parsed.data) }; }
  catch (error) { return { code: parsed.data, error: publicVistaError(error) }; }
}

export type ImportState = { error?: string };
export async function importPropertyAction(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { error: "Código Vista inválido." };
  let result;
  try { const admin=await requirePermission("properties:import");await enforceAdminVistaRateLimit(admin.id);result=await (await getAuthorizedAdminPropertyService("properties:import")).importVistaProperty(parsed.data); }
  catch(error){return {error:publicVistaError(error)}}
  redirect(`/admin/imoveis/${result.id}${result.status==="DUPLICATE"?"?duplicado=1":"?importado=1"}`);
}

function publicVistaError(error: unknown): string {
  if (error instanceof AdminOperationRateLimitError || error instanceof ForbiddenError || error instanceof AuthenticationRequiredError) return error.message;
  if (error instanceof VistaError) {
    if (error.code === "TIMEOUT" || error.code === "NETWORK") return "O Vista está indisponível no momento. Tente novamente.";
    if (error.code === "HTTP" && error.details.status === 401) return "A autenticação com o Vista falhou. Contate o responsável técnico.";
    if (error.code === "HTTP" && error.details.status === 404) return "Imóvel não encontrado no Vista.";
  }
  if (error instanceof z.ZodError) return "Código Vista inválido.";
  return "Não foi possível consultar este imóvel no Vista.";
}
