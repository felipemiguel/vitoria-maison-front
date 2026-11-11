"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/features/access/server";
import { assertSameOriginAction } from "@/features/access/request";
import { createUserManagementService } from "@/features/users/factory";
import { publicUserError } from "@/features/users/public-error";

export type UserFormState = { ok?: string; error?: string };

function formValues(form: FormData) {
  return { name: form.get("name"), email: form.get("email"), roles: form.getAll("roles").map(String), active: form.get("active") === "on" };
}

function inviteMessage(invitation: { delivered: boolean } | null): string {
  if (!invitation) return "sem-convite";
  return invitation.delivered ? "enviado" : "nao-enviado";
}

export async function createUserAction(_state: UserFormState, form: FormData): Promise<UserFormState> {
  let target: string;
  try {
    await assertSameOriginAction();
    const actor = await requirePermission("users:create");
    const result = await createUserManagementService().create(actor, formValues(form));
    revalidatePath("/admin/usuarios");
    target = `/admin/usuarios/${result.id}?criado=1&convite=${inviteMessage(result.invitation)}`;
  } catch (error) { return { error: publicUserError(error, "Não foi possível criar o usuário.") }; }
  redirect(target);
}

export async function updateUserAction(_state: UserFormState, form: FormData): Promise<UserFormState> {
  try {
    await assertSameOriginAction();
    // Permissões por campo (editar, desativar, atribuir perfis) são verificadas no serviço.
    const actor = await requirePermission("users:read");
    const id = String(form.get("id"));
    await createUserManagementService().update(actor, { ...formValues(form), id, version: form.get("version") });
    revalidatePath("/admin/usuarios"); revalidatePath(`/admin/usuarios/${id}`);
    return { ok: "Usuário atualizado." };
  } catch (error) { return { error: publicUserError(error, "Não foi possível atualizar o usuário.") }; }
}

export async function resendInviteAction(_state: UserFormState, form: FormData): Promise<UserFormState> {
  try {
    await assertSameOriginAction();
    const actor = await requirePermission("users:update");
    const id = String(form.get("id"));
    const result = await createUserManagementService().resendInvite(actor, id);
    revalidatePath(`/admin/usuarios/${id}`);
    return result.delivered
      ? { ok: "Novo convite enviado. Os links anteriores foram invalidados." }
      : { error: "Novo convite gerado e links anteriores invalidados, mas o e-mail NÃO foi enviado: o envio de e-mails não está configurado neste ambiente." };
  } catch (error) { return { error: publicUserError(error, "Não foi possível reenviar o convite.") }; }
}
