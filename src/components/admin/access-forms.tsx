"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { acceptInviteAction, requestPasswordResetAction, resetPasswordAction, type AccessFormState } from "@/app/admin/access-actions";

const input = "mt-2 h-12 w-full rounded-lg border border-[#d8ccc3] bg-white px-4 outline-none focus:border-[#66142e]";
const button = "flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#66142e] px-5 text-sm font-semibold text-white disabled:opacity-60";

function Feedback({ state }: { state: AccessFormState }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.ok}</p>;
  return null;
}

export function SetPasswordForm({ token, mode }: { token: string; mode: "invite" | "reset" }) {
  const [state, action, pending] = useActionState(mode === "invite" ? acceptInviteAction : resetPasswordAction, {} as AccessFormState);
  return <form action={action} className="mt-8 space-y-5"><input type="hidden" name="token" value={token}/>
    <label className="block text-sm font-medium text-[#443a35]">Nova senha<input name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" className={input}/></label>
    <label className="block text-sm font-medium text-[#443a35]">Confirmar senha<input name="confirmation" type="password" required minLength={12} maxLength={200} autoComplete="new-password" className={input}/></label>
    <p className="text-xs text-[#817872]">Use ao menos 12 caracteres. Uma frase longa é mais segura e fácil de lembrar.</p>
    <Feedback state={state}/><button disabled={pending} className={button}>{pending && <Loader2 className="animate-spin" size={17}/>} {mode === "invite" ? "Ativar meu acesso" : "Redefinir senha"}</button></form>;
}

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, {} as AccessFormState);
  return <form action={action} className="mt-8 space-y-5"><label className="block text-sm font-medium text-[#443a35]">E-mail<input name="email" type="email" required maxLength={320} autoComplete="email" className={input}/></label>
    <Feedback state={state}/><button disabled={pending} className={button}>{pending && <Loader2 className="animate-spin" size={17}/>} Enviar instruções</button>
    <p className="text-center text-sm"><Link href="/admin/login" className="text-[#66142e] underline underline-offset-4">Voltar ao login</Link></p></form>;
}
