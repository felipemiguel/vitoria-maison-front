"use client";

import { useActionState } from "react";
import { LoadingOverlay } from "@/components/admin/loading-overlay";
import { AdminActionFeedback } from "@/components/admin/admin-action-feedback";
import { changeOwnPasswordAction, updateOwnProfileAction, type AccountState } from "@/app/admin/(protected)/minha-conta/actions";

const input = "mt-2 w-full rounded-lg border border-[#d8ccc3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10";

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateOwnProfileAction, {} as AccountState);
  return <form action={action} className="space-y-4"><LoadingOverlay show={pending} label="Salvando…"/><label className="block text-sm font-medium">Nome<input name="name" defaultValue={name} required minLength={2} maxLength={160} autoComplete="name" className={input}/></label><AdminActionFeedback state={state}/><button disabled={pending} className="rounded-lg bg-[#66142e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Salvar</button></form>;
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPasswordAction, {} as AccountState);
  return <form action={action} className="space-y-4"><LoadingOverlay show={pending} label="Alterando senha…"/>
    <label className="block text-sm font-medium">Senha atual<input name="current" type="password" required autoComplete="current-password" className={input}/></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Nova senha<input name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" className={input}/></label><label className="block text-sm font-medium">Confirmar nova senha<input name="confirmation" type="password" required minLength={12} maxLength={200} autoComplete="new-password" className={input}/></label></div>
    <p className="text-xs text-[#817872]">Mínimo de 12 caracteres. Ao alterar, todas as sessões abertas serão encerradas e você entrará novamente.</p>
    <AdminActionFeedback state={state}/><button disabled={pending} className="rounded-lg bg-[#302724] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Alterar senha</button></form>;
}
