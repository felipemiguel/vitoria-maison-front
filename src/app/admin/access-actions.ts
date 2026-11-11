"use server";

import { redirect } from "next/navigation";
import { assertSameOriginAction, clientIp } from "@/features/access/request";
import { createAccountService } from "@/features/users/factory";
import { publicUserError } from "@/features/users/public-error";
import { RateLimitError } from "@/features/users/rate-limit";

export type AccessFormState = { ok?: string; error?: string };

export async function acceptInviteAction(_state: AccessFormState, form: FormData): Promise<AccessFormState> {
  try {
    await assertSameOriginAction();
    await createAccountService().acceptInvite({ token: form.get("token"), password: form.get("password"), confirmation: form.get("confirmation") }, await clientIp());
  } catch (error) { return { error: publicUserError(error, "Não foi possível ativar o acesso.") }; }
  redirect("/admin/login?convite=aceito");
}

/** Resposta sempre igual, exista ou não a conta. */
export async function requestPasswordResetAction(_state: AccessFormState, form: FormData): Promise<AccessFormState> {
  try {
    await assertSameOriginAction();
    await createAccountService().requestPasswordReset(form.get("email"), await clientIp());
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    // Outras falhas não alteram a resposta pública (evita enumeração), mas ficam registradas sem dados pessoais.
    console.error(JSON.stringify({ level: "error", event: "password_reset.request.failed", error: error instanceof Error ? error.name : "unknown" }));
  }
  return { ok: "Se houver uma conta ativa com este e-mail, você receberá as instruções em instantes." };
}

export async function resetPasswordAction(_state: AccessFormState, form: FormData): Promise<AccessFormState> {
  try {
    await assertSameOriginAction();
    await createAccountService().resetPassword({ token: form.get("token"), password: form.get("password"), confirmation: form.get("confirmation") }, await clientIp());
  } catch (error) { return { error: publicUserError(error, "Não foi possível redefinir a senha.") }; }
  redirect("/admin/login?senha=redefinida");
}
