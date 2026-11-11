"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/features/access/server";
import { assertSameOriginAction } from "@/features/access/request";
import { createBrokerServices } from "@/features/brokers/factory";
import { publicBrokerError } from "@/features/brokers/public-error";
import { revalidateBrokerSites } from "@/features/brokers/revalidation";
import type { BrokerFormState } from "../meu-site/actions";

const MESSAGES = { approve: "Site aprovado e publicado.", returnToDraft: "Solicitação devolvida ao corretor com a justificativa.", suspend: "Site suspenso.", reactivate: "Site reativado como rascunho." } as const;

function refresh(id: string) { revalidatePath("/admin/sites-corretores"); revalidatePath(`/admin/sites-corretores/${id}`); }

/** Somente ADMIN (broker-site:manage-all). O serviço revalida permissão, estado, versão e completude. */
export async function changeSiteStatusAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  try {
    await assertSameOriginAction();
    const user = await requirePermission("broker-site:manage-all");
    const { sites } = createBrokerServices();
    const id = String(form.get("id")); const version = form.get("version"); const reason = form.get("reason");
    const operation = String(form.get("operation")) as keyof typeof MESSAGES;
    if (operation === "approve") await sites.approve(user, id, version);
    else if (operation === "returnToDraft") await sites.returnToDraft(user, id, version, reason);
    else if (operation === "suspend") await sites.suspend(user, id, version, reason);
    else if (operation === "reactivate") await sites.reactivate(user, id, version);
    else return { error: "Operação inválida." };
    refresh(id);
    return { ok: MESSAGES[operation] };
  } catch (error) { return { error: publicBrokerError(error, "Não foi possível alterar o status.") }; }
}

export async function verifyCreciAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  try {
    await assertSameOriginAction();
    const user = await requirePermission("broker-site:manage-all");
    await createBrokerServices().profiles.verifyProfessionalData(user, String(form.get("profileId")), { creci: true });
    refresh(String(form.get("siteId"))); await revalidateBrokerSites();
    return { ok: "CRECI marcado como verificado." };
  } catch (error) { return { error: publicBrokerError(error, "Não foi possível verificar o CRECI.") }; }
}

/** Código de corretor no Vista: somente ADMIN. */
export async function setVistaCodeAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  try {
    await assertSameOriginAction();
    const user = await requirePermission("broker-site:manage-all");
    await createBrokerServices().profiles.setVistaBrokerCode(user, String(form.get("profileId")), form.get("vistaBrokerCode"));
    refresh(String(form.get("siteId")));
    return { ok: "Código do Vista atualizado." };
  } catch (error) { return { error: publicBrokerError(error, "Não foi possível salvar o código do Vista.") }; }
}
