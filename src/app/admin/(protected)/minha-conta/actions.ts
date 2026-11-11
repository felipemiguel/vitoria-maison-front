"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requirePermission } from "@/features/access/server";
import { assertSameOriginAction } from "@/features/access/request";
import { createAccountService } from "@/features/users/factory";
import { publicUserError } from "@/features/users/public-error";

export type AccountState = { ok?: string; error?: string };

export async function updateOwnProfileAction(_state: AccountState, form: FormData): Promise<AccountState> {
  try {
    await assertSameOriginAction();
    const user = await requirePermission("account:manage-own");
    await createAccountService().updateOwnProfile(user, { name: form.get("name") });
    revalidatePath("/admin", "layout");
    return { ok: "Dados atualizados." };
  } catch (error) { return { error: publicUserError(error, "Não foi possível atualizar seus dados.") }; }
}

/** Exige a senha atual. Após a troca, todas as sessões (inclusive esta) são encerradas. */
export async function changeOwnPasswordAction(_state: AccountState, form: FormData): Promise<AccountState> {
  try {
    await assertSameOriginAction();
    const user = await requirePermission("account:manage-own");
    await createAccountService().changeOwnPassword(user, { current: form.get("current"), password: form.get("password"), confirmation: form.get("confirmation") });
  } catch (error) { return { error: publicUserError(error, "Não foi possível alterar a senha.") }; }
  await signOut({ redirectTo: "/admin/login?senha=alterada" });
  return {};
}
