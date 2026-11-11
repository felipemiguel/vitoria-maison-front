"use client";
import { useActionState } from "react";
import { checkLeadAssignmentAction, reconcileLeadAction, type LeadRetryState } from "@/app/admin/(protected)/leads/actions";
import { LoadingOverlay } from "@/components/admin/loading-overlay";
import { AdminActionFeedback } from "./admin-action-feedback";

const input = "mt-1 h-10 w-full rounded-lg border border-[#d8ccc3] px-3 text-sm";
const button = "rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50";

/** Resultado indeterminado: só depois de conferir no Vista. "Não consta" libera nova tentativa (sem duplicar). */
export function LeadReconcileForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reconcileLeadAction, {} as LeadRetryState);
  return <form action={action} className="space-y-3">
    <LoadingOverlay show={pending} label="Registrando…"/>
    <input type="hidden" name="id" value={id}/>
    <label className="block text-xs text-[#746c67]">Código do lead no Vista (se encontrado)<input name="vistaReference" maxLength={200} className={input}/></label>
    <div className="flex flex-wrap gap-2">
      <button name="outcome" value="DELIVERED" disabled={pending} className={`${button} bg-[#302724] text-white`}>Consta no Vista</button>
      <button name="outcome" value="FAILED" disabled={pending} className={`${button} border border-[#d8ccc3] bg-white`}>Não consta no Vista</button>
    </div>
    <AdminActionFeedback state={state}/>
  </form>;
}

/** Conferência da atribuição feita manualmente no Vista. Não altera o responsável no CRM. */
export function LeadAssignmentForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(checkLeadAssignmentAction, {} as LeadRetryState);
  return <form action={action} className="space-y-3">
    <LoadingOverlay show={pending} label="Registrando…"/>
    <input type="hidden" name="id" value={id}/>
    <label className="block text-xs text-[#746c67]">Corretor encontrado no Vista (código, opcional)<input name="observedCode" maxLength={40} className={input}/></label>
    <div className="flex flex-wrap gap-2">
      <button name="outcome" value="CONFIRMED" disabled={pending} className={`${button} bg-emerald-700 text-white`}>Está com o corretor do site</button>
      <button name="outcome" value="MISMATCH" disabled={pending} className={`${button} border border-red-300 bg-white text-red-800`}>Está com outro corretor</button>
    </div>
    <AdminActionFeedback state={state}/>
  </form>;
}
