"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Check, Copy, CopyPlus, EyeOff, ImageUp, RotateCcw, Send, Trash2 } from "lucide-react";
import { AdminActionFeedback } from "@/components/admin/admin-action-feedback";
import { LoadingOverlay } from "@/components/admin/loading-overlay";
import {
  changeLandingStatusAction, createLandingPageAction, duplicateLandingPageAction, removeLandingHeroAction,
  saveLandingSettingsAction, uploadLandingHeroAction, type LandingFormState,
} from "@/app/admin/(protected)/landing-pages/actions";
import type { LandingPageStatus } from "@/database/schema";

export const inputClass = "mt-1.5 w-full min-w-0 rounded-lg border border-[#d8ccc3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#66142e] disabled:bg-[#f6f2ee] disabled:text-[#8a817b]";
const labelClass = "block text-sm font-medium text-[#342b27]";
const helpClass = "mt-1 text-xs leading-5 text-[#817872]";
const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#66142e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#d8ccc3] bg-white px-4 py-2.5 text-sm font-semibold text-[#342b27] disabled:opacity-50";

export function CreateLandingPageForm() {
  const [state, action, pending] = useActionState(createLandingPageAction, {} as LandingFormState);
  return <form action={action} className="grid gap-4 rounded-xl border border-[#ded5cd] bg-white p-5 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
    <LoadingOverlay show={pending} label="Criando página…"/>
    <label className={labelClass}>Nome interno<input name="name" required maxLength={120} placeholder="Ex.: Campanha Moema – junho" className={inputClass}/></label>
    <label className={labelClass}>Código do imóvel no Vista<input name="vistaCode" required maxLength={40} placeholder="Ex.: 12345" className={inputClass}/></label>
    <label className={labelClass}>Endereço (opcional)<input name="slug" maxLength={80} placeholder="apartamento-moema" className={inputClass}/></label>
    <button disabled={pending} className={primary}>Criar página</button>
    <p className={`${helpClass} md:col-span-4`}>O imóvel precisa estar publicado e visível no site. A página nasce em rascunho, com os blocos já preenchidos com os dados do imóvel.</p>
    <div className="md:col-span-4"><AdminActionFeedback state={state}/></div>
  </form>;
}

type Settings = { id: string; version: number; name: string; slug: string; slugLocked: boolean; whatsappNumber: string | null; whatsappMessage: string | null; seoTitle: string | null; seoDescription: string | null; defaultWhatsapp: string | null; archived: boolean };

export function LandingSettingsForm({ page }: { page: Settings }) {
  const [state, action, pending] = useActionState(saveLandingSettingsAction, {} as LandingFormState);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <LoadingOverlay show={pending} label="Salvando…"/>
    <input type="hidden" name="id" value={page.id}/><input type="hidden" name="version" value={page.version}/>
    <fieldset disabled={page.archived} className="contents">
      <label className={labelClass}>Nome interno<input name="name" required maxLength={120} defaultValue={page.name} className={inputClass}/></label>
      <label className={labelClass}>Endereço da página
        <div className="mt-1.5 flex items-center rounded-lg border border-[#d8ccc3] bg-white text-sm focus-within:border-[#66142e]"><span className="pl-3 text-[#8a817b]">/lp/</span><input name="slug" required maxLength={80} defaultValue={page.slug} disabled={page.slugLocked} className="min-w-0 flex-1 rounded-r-lg bg-transparent py-2.5 pr-3 outline-none disabled:text-[#8a817b]"/></div>
        <p className={helpClass}>{page.slugLocked ? "Travado após a primeira publicação, para não quebrar links já usados em anúncios." : "Letras minúsculas, números e hífens. Fica travado depois da primeira publicação."}</p>
      </label>
      <label className={labelClass}>WhatsApp da página<input name="whatsappNumber" inputMode="tel" maxLength={25} defaultValue={page.whatsappNumber ?? ""} placeholder={page.defaultWhatsapp ? `Padrão: ${page.defaultWhatsapp}` : "11 99999-9999"} className={inputClass}/>
        <p className={helpClass}>{page.defaultWhatsapp ? "Vazio = número institucional do site." : "Sem número institucional configurado: preencha para poder publicar."}</p></label>
      <label className={labelClass}>Mensagem inicial do WhatsApp<input name="whatsappMessage" maxLength={300} defaultValue={page.whatsappMessage ?? ""} placeholder="Olá! Vi a página do imóvel {codigo} e gostaria de mais informações." className={inputClass}/>
        <p className={helpClass}>Use {"{codigo}"} e {"{titulo}"} para inserir os dados do imóvel. Vazio = mensagem padrão.</p></label>
      <label className={labelClass}>Título de compartilhamento<input name="seoTitle" maxLength={70} defaultValue={page.seoTitle ?? ""} placeholder="Vazio = título do topo" className={inputClass}/>
        <p className={helpClass}>Aparece na aba do navegador e na prévia do link (WhatsApp, Instagram, anúncios).</p></label>
      <label className={labelClass}>Descrição de compartilhamento<input name="seoDescription" maxLength={170} defaultValue={page.seoDescription ?? ""} placeholder="Vazio = subtítulo do topo" className={inputClass}/></label>
      <div className="sm:col-span-2"><button disabled={pending} className={primary}>Salvar configurações</button><AdminActionFeedback state={state}/></div>
    </fieldset>
  </form>;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

export function LandingHeroUpload({ id, currentUrl, fallbackUrl, disabled }: { id: string; currentUrl: string | null; fallbackUrl: string | null; disabled: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, upload, uploading] = useActionState(async (previous: LandingFormState, form: FormData) => {
    const result = await uploadLandingHeroAction(previous, form);
    if (result.ok) { setPreview(null); formRef.current?.reset(); }
    return result;
  }, {} as LandingFormState);
  const [removeState, remove, removing] = useActionState(removeLandingHeroAction, {} as LandingFormState);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview ?? currentUrl ?? fallbackUrl;
  return <div className="grid gap-5 md:grid-cols-[280px_1fr]">
    <LoadingOverlay show={uploading || removing} label={uploading ? "Enviando imagem…" : "Removendo imagem…"}/>
    <div className="relative aspect-video overflow-hidden rounded-lg bg-[#ebe3dc]">
      {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou imagem já otimizada */}
      {shown ? <img src={shown} alt="Imagem de topo" className="h-full w-full object-cover"/> : <span className="grid h-full place-items-center text-xs text-[#817872]">Sem imagem</span>}
      {!currentUrl && !preview && fallbackUrl && <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white">Foto principal do imóvel</span>}
    </div>
    <div className="space-y-3">
      <form ref={formRef} action={upload} className="space-y-3">
        <input type="hidden" name="id" value={id}/>
        <label className={labelClass}>Imagem de topo (opcional)
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
        <p className={helpClass}>Formato horizontal (16:9), recortada em 1920 × 1080. JPEG, PNG ou WebP até 5 MB, mínimo 700 px. Sem imagem enviada, o topo usa a foto principal do imóvel no Vista.</p>
        {clientError && <p role="alert" className="text-sm text-red-700">{clientError}</p>}
        <button disabled={disabled || uploading || !preview} className={primary}><ImageUp size={16}/> Enviar imagem</button>
      </form>
      {currentUrl && !preview && !disabled && <form action={remove}><input type="hidden" name="id" value={id}/><button disabled={removing} className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccc3] px-3 py-1.5 text-xs font-semibold text-[#5f5652]"><Trash2 size={14}/> Usar a foto do imóvel</button></form>}
      <AdminActionFeedback state={state.ok || state.error ? state : removeState}/>
    </div>
  </div>;
}

export function LandingStatusActions({ id, version, status, ready }: { id: string; version: number; status: LandingPageStatus; ready: boolean }) {
  const [state, action, pending] = useActionState(changeLandingStatusAction, {} as LandingFormState);
  const [copyState, duplicate, duplicating] = useActionState(duplicateLandingPageAction, {} as LandingFormState);
  const button = (operation: string, label: string, icon: React.ReactNode, style: string, extra?: { disabled?: boolean; confirm?: string }) =>
    <form action={action} onSubmit={(event) => { if (extra?.confirm && !window.confirm(extra.confirm)) event.preventDefault(); }}>
      <input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/><input type="hidden" name="operation" value={operation}/>
      <button disabled={pending || extra?.disabled} className={style}>{icon} {label}</button>
    </form>;
  return <div>
    <LoadingOverlay show={pending || duplicating} label={duplicating ? "Duplicando…" : "Atualizando…"}/>
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && button("publish", "Publicar", <Send size={16}/>, primary, { disabled: !ready })}
      {status === "PUBLISHED" && button("unpublish", "Despublicar", <EyeOff size={16}/>, secondary, { confirm: "Despublicar? O endereço passa a responder 404 e anúncios ativos deixam de funcionar." })}
      {status !== "ARCHIVED" && button("archive", "Arquivar", <Archive size={16}/>, secondary, { confirm: status === "PUBLISHED" ? "Arquivar? A página sai do ar imediatamente." : undefined })}
      {status === "ARCHIVED" && button("restore", "Restaurar", <RotateCcw size={16}/>, secondary)}
      <form action={duplicate}><input type="hidden" name="id" value={id}/><button disabled={duplicating} className={secondary}><CopyPlus size={16}/> Duplicar</button></form>
    </div>
    <AdminActionFeedback state={state.ok || state.error ? state : copyState}/>
  </div>;
}

const UTM_FIELDS = [["utm_source", "Origem", "instagram, google, meta, email"], ["utm_medium", "Mídia", "cpc, social, email"], ["utm_campaign", "Campanha", "lancamento-moema"], ["utm_content", "Conteúdo (opcional)", "video-1"]] as const;

/** Monta o link com UTMs para anúncios. As UTMs são lidas pelo GA4 (quando habilitado); a página não as grava. */
export function LandingLinkBuilder({ url }: { url: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => {
    const target = new URL(url);
    for (const [key] of UTM_FIELDS) { const value = values[key]?.trim().toLowerCase().replace(/\s+/g, "-"); if (value) target.searchParams.set(key, value); }
    return target.toString();
  }, [url, values]);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{UTM_FIELDS.map(([key, label, placeholder]) => <label key={key} className={labelClass}>{label}<input value={values[key] ?? ""} maxLength={60} placeholder={placeholder} onChange={(event) => { setCopied(false); setValues({ ...values, [key]: event.target.value }); }} className={inputClass}/></label>)}</div>
    <div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={link} aria-label="Link para o anúncio" className={`${inputClass} mt-0 font-mono text-xs`} onFocus={(event) => event.target.select()}/>
      <button type="button" className={`${secondary} shrink-0 whitespace-nowrap`} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } }}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copiado" : "Copiar link"}</button></div>
  </div>;
}
