"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { syncAllPropertiesAction, type SyncAllPropertiesState } from "@/app/admin/(protected)/imoveis/actions";
import { AdminConfirmDialog } from "./admin-confirm-dialog";
import { LoadingOverlay } from "./loading-overlay";

export function SyncAllPropertiesButton({ total }: { total: number }) {
  const [state, action, pending] = useActionState(syncAllPropertiesAction, {} as SyncAllPropertiesState);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  const confirm = () => {
    confirmed.current = true;
    setConfirmationOpen(false);
    formRef.current?.requestSubmit();
  };

  return <>
    <div>
      <form ref={formRef} action={action} onSubmit={(event) => {
        if (confirmed.current) { confirmed.current = false; return; }
        event.preventDefault();
        setConfirmationOpen(true);
      }}>
        <LoadingOverlay show={pending} label="Sincronizando imóveis com o Vista…"/>
        <button type="submit" disabled={pending || total === 0} className="flex items-center gap-2 rounded-lg border border-[#66142e] bg-white px-4 py-2.5 text-sm font-semibold text-[#66142e] disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? <Loader2 size={17} className="animate-spin"/> : <RefreshCw size={17}/>} Sincronizar importados
        </button>
      </form>
      {state.error&&<p role="alert" className="mt-2 max-w-md rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{state.error}</p>}
      {state.ok&&<div role="status" className={`mt-2 max-w-md rounded-lg px-3 py-2 text-xs ${state.failed?"bg-amber-50 text-amber-900":"bg-emerald-50 text-emerald-800"}`}><p>{state.ok}</p>{state.failures?.map((failure)=><p key={failure.code} className="mt-1">{failure.code}: {failure.message}</p>)}{state.failed&&state.failed>10?<p className="mt-1">E mais {state.failed-10} falha(s).</p>:null}</div>}
    </div>
    <AdminConfirmDialog open={confirmationOpen} title="Sincronizar todos os imóveis importados?" description={`Os ${total} imóvel(is) da curadoria serão consultados no Vista. Os dados editoriais e o estado de publicação serão preservados.`} confirmLabel="Iniciar sincronização" onConfirm={confirm} onCancel={()=>setConfirmationOpen(false)}/>
  </>;
}
