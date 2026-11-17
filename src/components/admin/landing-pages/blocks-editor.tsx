"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { AdminActionFeedback } from "@/components/admin/admin-action-feedback";
import { LoadingOverlay } from "@/components/admin/loading-overlay";
import { saveLandingContentAction, type LandingFormState } from "@/app/admin/(protected)/landing-pages/actions";
import { ADDABLE_BLOCKS, BLOCK_LABELS, CONTENT_SCHEMA_VERSION, emptyBlock, type LandingBlock, type LandingBlockType } from "@/features/landing-pages/blocks";
import { inputClass } from "./landing-forms";

const label = "block text-sm font-medium text-[#342b27]";
const help = "mt-1 text-xs leading-5 text-[#817872]";
const iconButton = "inline-grid size-9 place-items-center rounded-lg border border-[#e4d7ce] bg-white text-[#5f5652] hover:border-[#66142e] hover:text-[#66142e] disabled:opacity-35";

/**
 * Editor de blocos: tudo é editado localmente e enviado de uma vez (JSON validado no servidor).
 * O servidor também confere a versão: duas abas abertas não sobrescrevem o trabalho uma da outra.
 */
export function BlocksEditor({ id, version, initial, disabled }: { id: string; version: number; initial: LandingBlock[]; disabled: boolean }) {
  const [blocks, setBlocks] = useState<LandingBlock[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState<LandingBlockType>("text");
  const [state, action, pending] = useActionState(async (previous: LandingFormState, form: FormData) => {
    const result = await saveLandingContentAction(previous, form);
    if (result.ok) setDirty(false);
    return result;
  }, {} as LandingFormState);

  const update = (next: LandingBlock[]) => { setBlocks(next); setDirty(true); };
  const patch = (index: number, value: Partial<LandingBlock>) => update(blocks.map((block, position) => position === index ? { ...block, ...value } as LandingBlock : block));
  const move = (index: number, delta: number) => { const next = [...blocks]; const [item] = next.splice(index, 1); next.splice(index + delta, 0, item); update(next); };
  const minIndex = blocks[0]?.type === "hero" ? 1 : 0;

  return <form action={action} className="space-y-4">
    <LoadingOverlay show={pending} label="Salvando blocos…"/>
    <input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/>
    <input type="hidden" name="content" value={JSON.stringify({ schemaVersion: CONTENT_SCHEMA_VERSION, blocks })}/>
    <fieldset disabled={disabled} className="space-y-4">
      {blocks.map((block, index) => <section key={block.id} className={`rounded-xl border bg-white ${block.enabled ? "border-[#ded5cd]" : "border-dashed border-[#d8ccc3] opacity-70"}`}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe7e1] px-4 py-3">
          <div><p className="font-semibold">{index + 1}. {BLOCK_LABELS[block.type].label}{!block.enabled && <span className="ml-2 text-xs font-normal text-[#817872]">(oculto)</span>}</p><p className="text-xs text-[#817872]">{BLOCK_LABELS[block.type].help}</p></div>
          <div className="flex gap-1.5">
            {block.type !== "hero" && <>
              <button type="button" className={iconButton} aria-label="Subir bloco" disabled={index <= minIndex} onClick={() => move(index, -1)}><ArrowUp size={16}/></button>
              <button type="button" className={iconButton} aria-label="Descer bloco" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button>
            </>}
            <button type="button" className={iconButton} aria-label={block.enabled ? "Ocultar bloco" : "Mostrar bloco"} onClick={() => patch(index, { enabled: !block.enabled })}>{block.enabled ? <Eye size={16}/> : <EyeOff size={16}/>}</button>
            {block.type !== "hero" && <button type="button" className={iconButton} aria-label="Remover bloco" onClick={() => { if (window.confirm(`Remover o bloco "${BLOCK_LABELS[block.type].label}"?`)) update(blocks.filter((_, position) => position !== index)); }}><Trash2 size={16}/></button>}
          </div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2"><BlockFields block={block} onChange={(value) => patch(index, value)}/></div>
      </section>)}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-[#d8ccc3] bg-white p-4">
        <label className={`${label} min-w-[220px] flex-1`}>Adicionar bloco<select value={adding} onChange={(event) => setAdding(event.target.value as LandingBlockType)} className={inputClass}>{ADDABLE_BLOCKS.map((type) => <option key={type} value={type}>{BLOCK_LABELS[type].label}</option>)}</select></label>
        <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccc3] bg-white px-4 py-2.5 text-sm font-semibold" onClick={() => update([...blocks, emptyBlock(adding)])}><Plus size={16}/> Adicionar</button>
        {blocks[0]?.type !== "hero" && <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccc3] bg-white px-4 py-2.5 text-sm font-semibold" onClick={() => update([emptyBlock("hero"), ...blocks])}><Plus size={16}/> Adicionar topo</button>}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border border-[#ded5cd] bg-white/95 px-4 py-3 backdrop-blur">
        <button disabled={pending || !dirty} className="inline-flex items-center gap-2 rounded-lg bg-[#66142e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Salvar blocos</button>
        <span className="text-xs text-[#817872]">{dirty ? "Há alterações não salvas." : "Tudo salvo."}</span>
      </div>
    </fieldset>
    <AdminActionFeedback state={state}/>
  </form>;
}

function Text({ name, value, onChange, max, placeholder, wide = false, hint }: { name: string; value: string; onChange: (value: string) => void; max: number; placeholder?: string; wide?: boolean; hint?: string }) {
  return <label className={`${label} ${wide ? "sm:col-span-2" : ""}`}>{name}<input value={value} maxLength={max} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={inputClass}/>{hint && <p className={help}>{hint}</p>}</label>;
}

function Area({ name, value, onChange, max = 4000, rows = 6, hint = "Linha em branco separa parágrafos. Comece a linha com “- ” para criar uma lista." }: { name: string; value: string; onChange: (value: string) => void; max?: number; rows?: number; hint?: string }) {
  return <label className={`${label} sm:col-span-2`}>{name}<textarea value={value} maxLength={max} rows={rows} onChange={(event) => onChange(event.target.value)} className={inputClass}/><p className={help}>{hint} {value.length}/{max}</p></label>;
}

function BlockFields({ block, onChange }: { block: LandingBlock; onChange: (value: Partial<LandingBlock>) => void }) {
  switch (block.type) {
    case "hero": return <>
      <Text name="Chamada (acima do título)" value={block.eyebrow} max={80} onChange={(eyebrow) => onChange({ eyebrow })} placeholder="Moema · São Paulo"/>
      <Text name="Texto do botão" value={block.ctaLabel} max={40} onChange={(ctaLabel) => onChange({ ctaLabel })} placeholder="Quero saber mais"/>
      <Text name="Título" value={block.title} max={120} onChange={(title) => onChange({ title })} wide/>
      <Text name="Subtítulo" value={block.subtitle} max={240} onChange={(subtitle) => onChange({ subtitle })} wide hint="O preço e a finalidade aparecem automaticamente, com os valores do Vista."/>
    </>;
    case "facts": return <Text name="Título" value={block.title} max={80} onChange={(title) => onChange({ title })} wide hint="Valor, área, dormitórios, suítes, vagas e código vêm do Vista."/>;
    case "text": return <><Text name="Título" value={block.title} max={80} onChange={(title) => onChange({ title })} wide/><Area name="Texto" value={block.body} onChange={(body) => onChange({ body })}/></>;
    case "gallery": return <>
      <Text name="Título" value={block.title} max={80} onChange={(title) => onChange({ title })}/>
      <label className={label}>Quantidade de fotos<input type="number" min={1} max={24} value={block.limit} onChange={(event) => onChange({ limit: Math.min(24, Math.max(1, Number(event.target.value) || 1)) })} className={inputClass}/><p className={help}>Fotos do Vista, na ordem do imóvel.</p></label>
    </>;
    case "location": return <><Text name="Título" value={block.title} max={80} onChange={(title) => onChange({ title })} wide hint="Bairro e cidade aparecem automaticamente."/><Area name="Sobre a região" value={block.body} onChange={(body) => onChange({ body })} hint="Comércio, transporte, lazer. Não informe o endereço exato."/></>;
    case "conditions": return <><Text name="Título" value={block.title} max={80} onChange={(title) => onChange({ title })} wide/><Area name="Condições" value={block.body} onChange={(body) => onChange({ body })} hint="Ex.: entrada, parcelas, aceita financiamento. A página adiciona o aviso de valores sujeitos a alteração."/></>;
    case "cta": return <>
      <Text name="Título" value={block.title} max={120} onChange={(title) => onChange({ title })}/>
      <Text name="Texto do botão" value={block.ctaLabel} max={40} onChange={(ctaLabel) => onChange({ ctaLabel })} placeholder="Falar no WhatsApp"/>
      <Text name="Texto" value={block.text} max={300} onChange={(text) => onChange({ text })} wide/>
    </>;
    case "highlights": return <>
      <Text name="Título" value={block.title} max={80} onChange={(title) => onChange({ title })} wide/>
      <ListEditor items={block.items} max={12} empty={{ title: "", text: "" }} addLabel="Adicionar diferencial" onChange={(items) => onChange({ items })}
        render={(item, set) => <><Text name="Diferencial" value={item.title} max={80} onChange={(title) => set({ ...item, title })}/><Text name="Descrição (opcional)" value={item.text} max={240} onChange={(text) => set({ ...item, text })}/></>}/>
    </>;
    case "faq": return <>
      <Text name="Título" value={block.title} max={80} onChange={(title) => onChange({ title })} wide/>
      <ListEditor items={block.items} max={12} empty={{ question: "", answer: "" }} addLabel="Adicionar pergunta" onChange={(items) => onChange({ items })}
        render={(item, set) => <><Text name="Pergunta" value={item.question} max={160} onChange={(question) => set({ ...item, question })} wide/><Area name="Resposta" value={item.answer} max={1000} rows={3} onChange={(answer) => set({ ...item, answer })}/></>}/>
    </>;
  }
}

function ListEditor<T>({ items, max, empty, addLabel, onChange, render }: { items: T[]; max: number; empty: T; addLabel: string; onChange: (items: T[]) => void; render: (item: T, set: (value: T) => void) => React.ReactNode }) {
  return <div className="space-y-3 sm:col-span-2">
    {items.map((item, index) => <div key={index} className="relative grid gap-3 rounded-lg border border-[#efe7e1] bg-[#fcfaf8] p-3 pr-12 sm:grid-cols-2">
      {render(item, (value) => onChange(items.map((current, position) => position === index ? value : current)))}
      <button type="button" aria-label="Remover item" className="absolute right-2 top-2 inline-grid size-8 place-items-center rounded-lg text-[#817872] hover:text-red-700" onClick={() => onChange(items.filter((_, position) => position !== index))}><X size={16}/></button>
    </div>)}
    {items.length < max && <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccc3] bg-white px-3 py-2 text-sm font-semibold" onClick={() => onChange([...items, empty])}><Plus size={15}/> {addLabel}</button>}
  </div>;
}
