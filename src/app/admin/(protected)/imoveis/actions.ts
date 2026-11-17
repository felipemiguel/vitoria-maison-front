"use server";

import { refresh, revalidatePath } from "next/cache";
import { enforceAdminVistaRateLimit } from "@/features/admin/auth/admin-operation-rate-limit";
import { getAuthorizedAdminServices } from "@/features/admin/properties/admin-property-service-factory";
import { publicAdminError } from "@/features/admin/public-error";
import { revalidatePublicCatalog } from "@/features/admin/revalidation";

export type SyncAllPropertiesState = {
  ok?: string;
  error?: string;
  total?: number;
  success?: number;
  failed?: number;
  failures?: Array<{ code: string; message: string }>;
};

export async function syncAllPropertiesAction(): Promise<SyncAllPropertiesState> {
  try {
    const { admin, sync } = await getAuthorizedAdminServices("properties:sync");
    await enforceAdminVistaRateLimit(admin.id);
    const results = await sync.syncAll();
    const success = results.filter((result) => result.status === "SUCCESS").length;
    const failures = results
      .filter((result) => result.status !== "SUCCESS")
      .map((result) => ({ code: result.code, message: result.message ?? "Falha na sincronização." }));
    await revalidatePublicCatalog();
    revalidatePath("/admin");
    revalidatePath("/admin/imoveis");
    refresh();
    return {
      ok: failures.length === 0
        ? `${success} imóvel(is) sincronizado(s) com sucesso.`
        : `Sincronização concluída com ${success} sucesso(s) e ${failures.length} falha(s).`,
      total: results.length,
      success,
      failed: failures.length,
      failures: failures.slice(0, 10),
    };
  } catch (error) {
    return { error: publicAdminError(error, "Não foi possível sincronizar os imóveis com o Vista.") };
  }
}
