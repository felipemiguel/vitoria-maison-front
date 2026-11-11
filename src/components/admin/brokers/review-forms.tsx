"use client";

import { useActionState } from "react";
import { LoadingOverlay } from "@/components/admin/loading-overlay";
import { AdminActionFeedback } from "@/components/admin/admin-action-feedback";
import { changeSiteStatusAction, setVistaCodeAction, verifyCreciAction } from "@/app/admin/(protected)/sites-corretores/actions";
import type { BrokerFormState } from "@/app/admin/(protected)/meu-site/actions";

const initial: BrokerFormState = {};

/** Decisão de revisão. Devolver e suspender exigem justificativa; aprovar exige completude (validada no servidor). */
export function ReviewDecisionForm({ id, version, status, ready }: { id: string; version: number; status: string; ready: boolean }) {
  const [state, action, pending] = useActionState(changeSiteStatusAction, initial);
  const canReason = status === "IN_REVIEW" || status === "PUBLISHED" || status === "DRAFT";
  return <form action={action} className="space-y-3">
    <LoadingOverlay show={pending} label="Registrando decisão…"/>
    <input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/>
    {canReason && <label className="block text-sm font-medium">Justificativa {status === "IN_REVIEW" ? "(obrigatória para devolver)" : "(obrigatória para suspender)"}<textarea name="reason" rows={3} maxLength={500} placeholder="Ex.: a biografia menciona informações que precisam ser comprovadas." className="mt-2 w-full rounded-lg border border-[#d8ccc3] p-3 text-sm outline-none focus:border-[#66142e]"/></label>}
    <div className="flex flex-wrap gap-2">
      {status === "IN_REVIEW" && <button name="operation" value="approve" disabled={pending || !ready} title={ready ? undefined : "O site ainda não cumpre os requisitos mínimos"} className="rounded-lg bg-[#66142e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Aprovar e publicar</button>}
      {status === "IN_REVIEW" && <button name="operation" value="returnToDraft" disabled={pending} className="rounded-lg border border-[#d8ccc3] px-4 py-2 text-sm font-semibold">Devolver ao corretor</button>}
      {status !== "SUSPENDED" && <button name="operation" value="suspend" disabled={pending} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">Suspender</button>}
      {status === "SUSPENDED" && <button name="operation" value="reactivate" disabled={pending} className="rounded-lg border border-[#d8ccc3] px-4 py-2 text-sm font-semibold">Reativar como rascunho</button>}
    </div>
    {status === "IN_REVIEW" && !ready && <p className="text-xs text-red-700">Aprovação bloqueada até que todos os itens obrigatórios estejam completos.</p>}
    <AdminActionFeedback state={state}/>
  </form>;
}

export function VerifyCreciForm({ profileId, siteId }: { profileId: string; siteId: string }) {
  const [state, action, pending] = useActionState(verifyCreciAction, initial);
  return <form action={action} className="space-y-2"><LoadingOverlay show={pending} label="Verificando…"/><input type="hidden" name="profileId" value={profileId}/><input type="hidden" name="siteId" value={siteId}/><button disabled={pending} className="rounded-lg border border-[#66142e] px-3 py-1.5 text-xs font-semibold text-[#66142e]">Marcar CRECI como verificado</button><AdminActionFeedback state={state}/></form>;
}

export function VistaCodeForm({ profileId, siteId, current }: { profileId: string; siteId: string; current: string | null }) {
  const [state, action, pending] = useActionState(setVistaCodeAction, initial);
  return <form action={action} className="space-y-2"><LoadingOverlay show={pending} label="Salvando…"/><input type="hidden" name="profileId" value={profileId}/><input type="hidden" name="siteId" value={siteId}/>
    <div className="flex flex-wrap gap-2"><input name="vistaBrokerCode" defaultValue={current ?? ""} maxLength={40} placeholder="Código no Vista" className="rounded-lg border border-[#d8ccc3] px-3 py-1.5 text-sm"/><button disabled={pending} className="rounded-lg border border-[#d8ccc3] px-3 py-1.5 text-xs font-semibold">Salvar</button></div>
    <AdminActionFeedback state={state}/></form>;
}
