"use client";
import { LoadingOverlay } from "@/components/admin/loading-overlay";

import Image from "next/image";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { useActionState } from "react";
import { importPropertyAction, previewPropertyAction, type ImportState, type PreviewState } from "@/app/admin/(protected)/imoveis/novo/actions";

const initialState: PreviewState = {};

export function PropertyImportForm() {
  const [state, action, pending] = useActionState(previewPropertyAction, initialState);
  return <div className="space-y-6"><form action={action} className="rounded-xl border border-[#ded5cd] bg-white p-5"><LoadingOverlay show={pending} label="Consultando o Vista…"/><label className="block max-w-xl text-sm font-medium">Código do imóvel no Vista<div className="mt-2 flex gap-2"><input name="code" defaultValue={state.code} required autoComplete="off" className="h-11 min-w-0 flex-1 rounded-lg border border-[#d8ccc3] px-4 outline-none focus:border-[#66142e]" placeholder="Ex.: 31"/><button disabled={pending} className="flex h-11 items-center gap-2 rounded-lg bg-[#302724] px-5 text-sm font-semibold text-white disabled:opacity-60">{pending?<Loader2 size={16} className="animate-spin"/>:<Search size={16}/>} Consultar</button></div></label>{state.error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}</form>
    {state.result?.status==="DUPLICATE"&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-semibold text-amber-950">Imóvel já importado</h3><p className="mt-1 text-sm text-amber-800">O código Vista {state.result.vistaCode} já faz parte da curadoria.</p><Link href={`/admin/imoveis/${state.result.id}`} className="mt-4 inline-block text-sm font-semibold text-[#66142e]">Abrir imóvel →</Link></div>}
    {state.result?.status==="READY"&&<Preview property={state.result.property} code={state.code!}/>} 
  </div>;
}

function Preview({property,code}:{property:Extract<NonNullable<PreviewState["result"]>,{status:"READY"}>["property"];code:string}) {
  const data=[["Código",property.externalCode],["Categoria",property.rawCategory],["Localização",[property.neighborhood,property.city].filter(Boolean).join(", ")],["Venda",money(property.salePrice)],["Locação",money(property.rentalPrice)],["Área privativa",property.privateArea?`${property.privateArea} m²`:null],["Dormitórios",property.bedrooms],["Suítes",property.suites],["Vagas",property.parkingSpaces]];
  return <section className="overflow-hidden rounded-xl border border-[#ded5cd] bg-white"><div className="grid md:grid-cols-[320px_1fr]">{property.coverImageUrl?<div className="relative min-h-64 bg-[#eee7e1]"><Image src={property.coverImageUrl} alt="Foto de destaque do imóvel" fill sizes="(max-width: 767px) 100vw, 320px" className="object-cover"/></div>:<div className="grid min-h-52 place-items-center bg-[#eee7e1] text-sm text-[#817872]">Sem foto de destaque</div>}<div className="p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#9b6a2f]">Prévia do Vista</p><h3 className="mt-2 text-xl font-semibold">Confirme os dados antes de importar</h3><dl className="mt-6 grid gap-4 sm:grid-cols-2">{data.filter(([,value])=>value!==null&&value!==undefined&&value!=="").map(([label,value])=><div key={String(label)}><dt className="text-xs text-[#817872]">{label}</dt><dd className="mt-1 text-sm font-medium">{String(value)}</dd></div>)}</dl><ConfirmImport code={code}/></div></div></section>;
}
function ConfirmImport({code}:{code:string}){const [state,action,pending]=useActionState(importPropertyAction,{} as ImportState);return <form action={action} className="mt-7"><LoadingOverlay show={pending} label="Importando imóvel…"/><input type="hidden" name="code" value={code}/>{state.error&&<p role="alert" className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}<button disabled={pending} className="flex items-center gap-2 rounded-lg bg-[#66142e] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{pending&&<Loader2 size={16} className="animate-spin"/>} Confirmar importação</button><p className="mt-3 text-xs text-[#817872]">O imóvel será criado como rascunho e não aparecerá no site.</p></form>}
function money(value:number|undefined){return value===undefined?null:new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value)}
