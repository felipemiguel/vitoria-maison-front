"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AdminActionState } from "@/app/admin/(protected)/imoveis/[id]/actions";

export function AdminActionFeedback({ state }: { state: AdminActionState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.error || state.ok) ref.current?.focus(); }, [state.error, state.ok]);
  if (!state.error && !state.ok) return null;
  const error = Boolean(state.error);
  return <div ref={ref} tabIndex={-1} role={error?"alert":"status"} className={`mt-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#66142e]/30 ${error?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{error?<CircleAlert className="mt-0.5 shrink-0" size={17}/>:<CheckCircle2 className="mt-0.5 shrink-0" size={17}/>}<span>{state.error??state.ok}</span></div>;
}
