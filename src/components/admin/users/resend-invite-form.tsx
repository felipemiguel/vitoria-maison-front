"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { LoadingOverlay } from "@/components/admin/loading-overlay";
import { AdminActionFeedback } from "@/components/admin/admin-action-feedback";
import { resendInviteAction, type UserFormState } from "@/app/admin/(protected)/usuarios/actions";

export function ResendInviteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resendInviteAction, {} as UserFormState);
  return <form action={action} className="space-y-3"><LoadingOverlay show={pending} label="Gerando novo convite…"/><input type="hidden" name="id" value={id}/><button disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-[#66142e] px-4 py-2 text-sm font-semibold text-[#66142e] hover:bg-[#fbf7f4] disabled:opacity-50"><Send size={15}/> Reenviar convite</button><AdminActionFeedback state={state}/></form>;
}
