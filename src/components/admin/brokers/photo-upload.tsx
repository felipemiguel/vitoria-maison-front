"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { LoadingOverlay } from "@/components/admin/loading-overlay";
import { AdminActionFeedback } from "@/components/admin/admin-action-feedback";
import { removeHeroAction, removeOwnPhotoAction, uploadHeroAction, uploadOwnPhotoAction, type BrokerFormState } from "@/app/admin/(protected)/meu-site/actions";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Envio da foto profissional com prévia local. As validações aqui são apenas conveniência:
 * o servidor revalida o conteúdo, recorta em 4:5, reduz e remove metadados (inclusive GPS).
 */
type Variant = "photo" | "presentation";
const VARIANTS: Record<Variant, { label: string; help: string; empty: string; upload: typeof uploadOwnPhotoAction; remove: typeof removeOwnPhotoAction }> = {
  photo: { label: "Foto profissional", help: "JPEG, PNG ou WebP, até 5 MB e pelo menos 400 × 400 px. A foto é recortada em formato vertical (4:5); use uma imagem sua, com o rosto bem visível. Dados de localização do arquivo são removidos.", empty: "Sem foto. O site mostra suas iniciais.", upload: uploadOwnPhotoAction, remove: removeOwnPhotoAction },
  presentation: { label: "Imagem de apresentação", help: "Aparece no topo da sua página (formato vertical 4:5). JPEG, PNG ou WebP, até 5 MB e pelo menos 600 × 600 px. Sem imagem, o topo usa sua foto profissional.", empty: "Sem imagem. O topo usa sua foto.", upload: uploadHeroAction, remove: removeHeroAction },
};

export function PhotoUpload({ currentUrl, name, variant = "photo", disabled = false }: { currentUrl: string | null; name: string; variant?: Variant; disabled?: boolean }) {
  const config = VARIANTS[variant];
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, upload, uploading] = useActionState(async (previous: BrokerFormState, form: FormData) => {
    const result = await config.upload(previous, form);
    if (result.ok) { setPreview(null); formRef.current?.reset(); }
    return result;
  }, {} as BrokerFormState);
  const [removeState, remove, removing] = useActionState(config.remove, {} as BrokerFormState);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview ?? currentUrl;
  return <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
    <LoadingOverlay show={uploading || removing} label={uploading ? "Enviando imagem…" : "Removendo imagem…"}/>
    <div className="relative aspect-[4/5] w-[140px] overflow-hidden rounded-lg bg-[#ebe3dc]">
      {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou mídia já otimizada */}
      {shown ? <img src={shown} alt={`${config.label} de ${name}`} className="h-full w-full object-cover"/> : <span className="grid h-full place-items-center px-3 text-center text-xs text-[#817872]">{config.empty}</span>}
    </div>
    <div className="space-y-3">
      <form ref={formRef} action={upload} className="space-y-3">
        <label className="block text-sm font-medium">{config.label}
          <input name="photo" type="file" accept={ACCEPT} required disabled={disabled} className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#f4ece6] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#66142e]"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setClientError(null);
              if (preview) URL.revokeObjectURL(preview);
              if (!file) { setPreview(null); return; }
              if (!ACCEPT.split(",").includes(file.type)) { setClientError("Envie uma imagem JPEG, PNG ou WebP."); event.target.value = ""; setPreview(null); return; }
              if (file.size > MAX_BYTES) { setClientError("A imagem deve ter no máximo 5 MB."); event.target.value = ""; setPreview(null); return; }
              setPreview(URL.createObjectURL(file));
            }}/>
        </label>
        <p className="text-xs leading-5 text-[#817872]">{config.help}</p>
        {clientError && <p role="alert" className="text-sm text-red-700">{clientError}</p>}
        <button disabled={disabled || uploading || !preview} className="inline-flex items-center gap-2 rounded-lg bg-[#66142e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><ImageUp size={16}/> Enviar imagem</button>
      </form>
      {currentUrl && !preview && !disabled && <form action={remove}><button disabled={removing} className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccc3] px-3 py-1.5 text-xs font-semibold text-[#5f5652]"><Trash2 size={14}/> Remover imagem</button></form>}
      <AdminActionFeedback state={state.ok || state.error ? state : removeState}/>
    </div>
  </div>;
}
