"use client";
import { LoadingOverlay } from "@/components/admin/loading-overlay";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { AdminActionFeedback } from "./admin-action-feedback";
import { AdminConfirmDialog } from "./admin-confirm-dialog";
import type { AdminPropertyDetails } from "@/features/admin/properties/types";
import { saveAndPublishPropertyAction, syncPropertyAction, unpublishPropertyAction, type AdminActionState } from "@/app/admin/(protected)/imoveis/[id]/actions";
import { availabilityDisplay, availabilityLabel } from "@/features/admin/properties/availability-display";

const initial:AdminActionState={};

export function PropertyManagement({property}:{property:AdminPropertyDetails}){
  return <div className="space-y-6"><CurationPublicationForm property={property}/><section className="rounded-xl border border-[#ded5cd] bg-white p-5 sm:p-6"><h3 className="text-base font-semibold">Outras operações</h3><p className="mt-2 text-sm text-[#746c67]">Sincronização, prévia e retirada do site permanecem independentes da edição.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{property.published&&<CriticalForm action={unpublishPropertyAction} property={property} label="Despublicar imóvel" confirm="Retirar este imóvel do site?"/>}<CriticalForm action={syncPropertyAction} property={property} label="Sincronizar com Vista" confirm="Atualizar os dados comerciais com o Vista agora?"/><Link href={`/admin/imoveis/${property.id}/preview`} className="grid min-h-11 place-items-center rounded-lg border border-[#66142e] px-4 text-sm font-semibold text-[#66142e]">Visualizar prévia</Link></div></section></div>
}

function CurationPublicationForm({property}:{property:AdminPropertyDetails}) {
  const [state,action,pending]=useActionState(saveAndPublishPropertyAction,initial);
  const [title,setTitle]=useState(property.editorialTitle??"");
  const [description,setDescription]=useState(property.editorialDescription??"");
  const [vistaConfirmationOpen,setVistaConfirmationOpen]=useState(false);
  const [publicationConfirmationOpen,setPublicationConfirmationOpen]=useState(false);
  const formRef=useRef<HTMLFormElement>(null);
  const publicationConfirmed=useRef(false);
  const availability=availabilityDisplay(property);
  const manualAvailability=availability==="MANUAL_CONFIRMED"?"AVAILABLE":"UNKNOWN";
  const hasVistaContent=Boolean(property.sourceTitle?.trim()||property.sourceDescription?.trim());
  const applyVistaContent=()=>{
    if(property.sourceTitle?.trim())setTitle(property.sourceTitle.trim());
    if(property.sourceDescription?.trim())setDescription(property.sourceDescription.trim());
    setVistaConfirmationOpen(false);
  };
  const handleSubmit=(event:React.FormEvent<HTMLFormElement>)=>{
    if(property.published||publicationConfirmed.current){publicationConfirmed.current=false;return}
    event.preventDefault();setPublicationConfirmationOpen(true);
  };
  const confirmPublication=()=>{publicationConfirmed.current=true;setPublicationConfirmationOpen(false);formRef.current?.requestSubmit()};
  return <form ref={formRef} key={property.publicationVersion} action={action} onSubmit={handleSubmit} className="rounded-xl border border-[#ded5cd] bg-white p-5 sm:p-6"><LoadingOverlay show={pending} label="Salvando alterações…"/>
    <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#9b6a2f]">Fluxo único</p><h3 className="mt-1 text-lg font-semibold">Curadoria e publicação</h3><p className="mt-2 text-sm text-[#746c67]">Preencha os dados abaixo. Ao finalizar, o sistema salva, valida e publica o imóvel.</p></div>
    <input type="hidden" name="id" value={property.id}/><input type="hidden" name="code" value={property.vistaCode}/><input type="hidden" name="version" value={property.publicationVersion}/>
    <div className="mt-6 grid gap-4">
      <label className="text-sm font-medium">Título editorial<input name="title" value={title} onChange={(event)=>setTitle(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#d8ccc3] px-3 outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10"/></label>
      <label className="text-sm font-medium">Descrição editorial<textarea name="description" rows={5} value={description} onChange={(event)=>setDescription(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d8ccc3] p-3 outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10"/></label>
      <section className="rounded-lg border border-[#d3a865]/45 bg-[#fffaf1] p-4" aria-labelledby="vista-content-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 id="vista-content-title" className="text-sm font-semibold">Conteúdo recebido do Vista</h4><p className="mt-1 text-xs text-[#746c67]">Atualizado pela última sincronização. A curadoria nunca é substituída automaticamente.</p></div>{hasVistaContent&&<button type="button" onClick={()=>setVistaConfirmationOpen(true)} className="rounded-lg border border-[#66142e] px-3 py-2 text-xs font-semibold text-[#66142e] outline-none hover:bg-[#66142e] hover:text-white focus-visible:ring-2 focus-visible:ring-[#66142e] focus-visible:ring-offset-2">Usar conteúdo do Vista</button>}</div>
        {hasVistaContent?<dl className="mt-4 grid gap-4 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-[.08em] text-[#9b6a2f]">Título no Vista</dt><dd className="mt-1 whitespace-pre-wrap text-[#453d39]">{property.sourceTitle?.trim()||"Não informado"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.08em] text-[#9b6a2f]">Descrição no Vista</dt><dd className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[#453d39]">{property.sourceDescription?.trim()||"Não informada"}</dd></div></dl>:<p className="mt-4 text-sm text-[#746c67]">O Vista ainda não retornou título ou descrição para este imóvel.</p>}
      </section>
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Finalidade editorial<select name="purpose" defaultValue={property.publicationPurpose??""} className="mt-2 h-11 w-full rounded-lg border border-[#d8ccc3] bg-white px-3 outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10"><option value="">Não definida</option><option value="SALE">Venda</option><option value="RENT">Locação</option><option value="INVESTMENT">Investimento</option></select></label>{property.availabilityStatus==="UNKNOWN"?<label className="text-sm font-medium">Disponibilidade manual<select name="availability" defaultValue={manualAvailability} className="mt-2 h-11 w-full rounded-lg border border-[#d8ccc3] bg-white px-3 outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10"><option value="UNKNOWN">Não confirmada</option><option value="AVAILABLE">Disponível</option></select><span className="mt-2 block text-xs font-normal text-[#746c67]">Situação atual: {availabilityLabel(availability)}.</span></label>:property.availabilityStatus==="AVAILABLE"?<p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">O Vista informou que o imóvel está disponível.</p>:<p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">O Vista informou indisponibilidade; a publicação está bloqueada.</p>}</div>
      <Field label="Imagem de capa editorial (HTTPS autorizado)" name="coverUrl" defaultValue={property.coverImageUrl??""}/><div className="rounded-lg border border-[#ded5cd] bg-[#faf8f5] p-4"><h4 className="text-sm font-semibold">Destaque da home</h4><div className="mt-3 flex flex-wrap items-end gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={property.featured} className="accent-[#66142e]"/> Destacar após publicar</label><Field label="Ordem" name="order" type="number" defaultValue={property.featuredOrder??1}/></div></div>
    </div><Feedback state={state}/><button disabled={pending} className="mt-6 w-full rounded-lg bg-[#66142e] px-5 py-3 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#d3a865] focus-visible:ring-offset-2 disabled:opacity-50">{pending?"Salvando e validando…":property.published?"Salvar alterações":"Salvar e publicar imóvel"}</button>
    <AdminConfirmDialog open={vistaConfirmationOpen} title="Usar conteúdo do Vista?" description="O título e a descrição recebidos do Vista substituirão o conteúdo atual nos campos editoriais. A alteração será gravada somente quando você salvar o imóvel." confirmLabel="Usar conteúdo do Vista" onConfirm={applyVistaContent} onCancel={()=>setVistaConfirmationOpen(false)}/>
    <AdminConfirmDialog open={publicationConfirmationOpen} title="Publicar este imóvel?" description="A curadoria será salva e as regras de disponibilidade, preço, imagem e finalidade serão validadas antes de disponibilizar o imóvel no site." confirmLabel="Salvar e publicar" onConfirm={confirmPublication} onCancel={()=>setPublicationConfirmationOpen(false)}/>
  </form>
}
function CriticalForm({action,property,label,confirm}:{action:(state:AdminActionState,form:FormData)=>Promise<AdminActionState>;property:AdminPropertyDetails;label:string;confirm:string}){const [state,formAction,pending]=useActionState(action,initial);const [open,setOpen]=useState(false);const formRef=useRef<HTMLFormElement>(null);const confirmed=useRef(false);const danger=label.startsWith("Despublicar");return <form ref={formRef} action={formAction} onSubmit={(event)=>{if(confirmed.current){confirmed.current=false;return}event.preventDefault();setOpen(true)}}><LoadingOverlay show={pending} label="Processando…"/><input type="hidden" name="id" value={property.id}/><input type="hidden" name="code" value={property.vistaCode}/><button disabled={pending} className="min-h-11 w-full rounded-lg bg-[#302724] px-4 text-sm font-semibold text-white disabled:opacity-50">{pending?"Processando…":label}</button><Feedback state={state}/><AdminConfirmDialog open={open} title={`${label}?`} description={confirm} confirmLabel={label} tone={danger?"danger":"primary"} onConfirm={()=>{confirmed.current=true;setOpen(false);formRef.current?.requestSubmit()}} onCancel={()=>setOpen(false)}/></form>}
function Field({label,name,defaultValue,type="text"}:{label:string;name:string;defaultValue:string|number;type?:string}){return <label className="text-sm font-medium">{label}<input name={name} type={type} defaultValue={defaultValue} className="mt-2 h-11 w-full rounded-lg border border-[#d8ccc3] px-3 outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10"/></label>}
function Feedback({state}:{state:AdminActionState}){return <AdminActionFeedback state={state}/>}
