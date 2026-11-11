"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Star, Trash2 } from "lucide-react";
import { LoadingOverlay } from "@/components/admin/loading-overlay";
import { AdminActionFeedback } from "@/components/admin/admin-action-feedback";
import { addPropertiesAction, checkSubdomainAction, createOwnSiteAction, manageSelectionAction, saveOwnProfileAction, submitOwnSiteAction, updateOwnSiteAction, type BrokerFormState } from "@/app/admin/(protected)/meu-site/actions";
import type { SubdomainAvailability } from "@/features/brokers/broker-subdomain-service";

const input = "mt-2 w-full rounded-lg border border-[#d8ccc3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10 read-only:bg-[#f4f0ec] read-only:text-[#817872]";
const primary = "rounded-lg bg-[#66142e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const hint = "mt-1 block text-xs font-normal text-[#817872]";
const initial: BrokerFormState = {};

type Profile = { displayName: string; professionalTitle: string | null; biography: string | null; whatsapp: string | null; phone: string | null; emailPublic: string | null; creci: string | null; specialties: string[]; serviceRegions: string[]; creciVerified: boolean };

/** Perfil profissional. O código Vista não aparece (somente ADMIN configura). */
export function BrokerProfileForm({ profile, defaultName }: { profile: Profile | null; defaultName: string }) {
  const [state, action, pending] = useActionState(saveOwnProfileAction, initial);
  const [bio, setBio] = useState(profile?.biography ?? "");
  const text = (name: keyof Profile, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="text-sm font-medium">{label}<input name={name} defaultValue={(profile?.[name] as string | null) ?? ""} className={input} {...props}/></label>;
  return <form action={action} className="space-y-5">
    <LoadingOverlay show={pending} label="Salvando perfil…"/>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Nome profissional<input name="displayName" required minLength={2} maxLength={120} defaultValue={profile?.displayName ?? defaultName} className={input}/></label>
      {text("professionalTitle", "Título profissional", { placeholder: "Ex.: Consultora de flats e investimentos", maxLength: 120 })}
      {text("whatsapp", "WhatsApp profissional", { inputMode: "tel", placeholder: "11999999999" })}
      {text("phone", "Telefone profissional", { inputMode: "tel" })}
      {text("emailPublic", "E-mail público", { type: "email" })}
      <label className="text-sm font-medium">CRECI<input name="creci" defaultValue={profile?.creci ?? ""} placeholder="123456-F/SP" className={input}/>
        <span className={hint}>{!profile?.creci ? "Informe seu CRECI; a equipe confere antes de exibir no site." : profile.creciVerified ? "Verificado. Alterar o número gera uma nova solicitação de verificação." : "Aguardando verificação da equipe. Enquanto isso, não aparece no site."}</span></label>
    </div>
    <label className="block text-sm font-medium">Biografia<textarea name="biography" rows={5} maxLength={2000} value={bio} onChange={(event) => setBio(event.target.value)} className={input}/><span className={hint}>{bio.trim().length}/2000 · mínimo de 40 caracteres para publicar. Conte como você atende; evite informações que não possam ser comprovadas.</span></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Especialidades<input name="specialties" defaultValue={profile?.specialties.join(", ") ?? ""} placeholder="Flats, Investimento" className={input}/><span className={hint}>Separe por vírgula (até 12).</span></label>
      <label className="text-sm font-medium">Regiões atendidas<input name="serviceRegions" defaultValue={profile?.serviceRegions.join(", ") ?? ""} placeholder="Moema, Itaim Bibi" className={input}/><span className={hint}>Separe por vírgula (até 12).</span></label>
    </div>
    <AdminActionFeedback state={state}/>
    <button disabled={pending} className={primary}>{profile ? "Salvar perfil" : "Criar perfil profissional"}</button>
  </form>;
}

export function CreateSiteForm({ suggestion, baseDomain }: { suggestion: string; baseDomain: string | null }) {
  const [state, action, pending] = useActionState(createOwnSiteAction, initial);
  const [value, setValue] = useState(suggestion);
  const [availability, setAvailability] = useState<SubdomainAvailability | null>(null);
  const [checking, startCheck] = useTransition();
  return <form action={action} className="space-y-4">
    <LoadingOverlay show={pending} label="Criando site…"/>
    <label className="block text-sm font-medium">Endereço do site
      <div className="mt-2 flex flex-wrap items-center gap-2"><input name="subdomain" value={value} onChange={(event) => { setValue(event.target.value.toLowerCase()); setAvailability(null); }} required minLength={3} maxLength={30} pattern="[a-z0-9-]+" className={`${input} mt-0 max-w-xs`}/><span className="text-sm text-[#746c67]">.{baseDomain ?? "dominio-dos-corretores"}</span>
        <button type="button" onClick={() => startCheck(async () => setAvailability(await checkSubdomainAction(value)))} className="rounded-lg border border-[#66142e] px-3 py-2 text-sm font-semibold text-[#66142e]">{checking ? "Verificando…" : "Verificar"}</button></div>
    </label>
    {availability && (availability.available
      ? <p role="status" className="text-sm text-emerald-700">Disponível{availability.publicUrl ? `: ${availability.publicUrl}` : "."}</p>
      : <p role="alert" className="text-sm text-red-700">{availability.message}{availability.suggestions.length > 0 && <> Sugestões: {availability.suggestions.map((item) => <button type="button" key={item} onClick={() => { setValue(item); setAvailability(null); }} className="ml-2 underline">{item}</button>)}</>}</p>)}
    <label className="block text-sm font-medium">Título principal (opcional)<input name="headline" maxLength={160} className={input}/></label>
    <p className="text-xs text-[#817872]">O site nasce em rascunho e só fica público após a aprovação de um administrador.</p>
    <AdminActionFeedback state={state}/>
    <button disabled={pending} className={primary}>Criar site em rascunho</button>
  </form>;
}

type SiteContent = { version: number; status: string; subdomain: string; headline: string | null; subtitle: string | null; introText: string | null; serviceText: string | null };

/** Página inicial. Texto simples (sem HTML), com limites. Endereço só muda em rascunho. */
export function EditSiteForm({ site, editable }: { site: SiteContent; editable: boolean }) {
  const [state, action, pending] = useActionState(updateOwnSiteAction, initial);
  const area = (name: "introText" | "serviceText", label: string, max: number, help: string) => <label className="block text-sm font-medium">{label}<textarea name={name} rows={3} maxLength={max} defaultValue={site[name] ?? ""} readOnly={!editable} className={input}/><span className={hint}>{help} Até {max} caracteres, sem HTML.</span></label>;
  return <form action={action} className="space-y-5">
    <LoadingOverlay show={pending} label="Salvando página…"/><input type="hidden" name="version" value={site.version}/>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Título principal<input name="headline" defaultValue={site.headline ?? ""} readOnly={!editable} maxLength={160} className={input}/><span className={hint}>Aparece em destaque no topo da página.</span></label>
      <label className="text-sm font-medium">Endereço (subdomínio)<input name="subdomain" defaultValue={site.subdomain} readOnly={!editable || site.status !== "DRAFT"} minLength={3} maxLength={30} className={input}/><span className={hint}>{site.status === "DRAFT" ? "Pode ser alterado enquanto o site está em rascunho." : "Fixo após a primeira solicitação de publicação."}</span></label>
    </div>
    <label className="block text-sm font-medium">Subtítulo<input name="subtitle" defaultValue={site.subtitle ?? ""} readOnly={!editable} maxLength={300} className={input}/></label>
    {area("introText", "Texto de introdução", 400, "Aparece acima da sua seleção de imóveis.")}
    {area("serviceText", "Texto de atendimento", 300, "Aparece na seção de contato.")}
    <AdminActionFeedback state={state}/>
    {editable ? <button disabled={pending} className={primary}>Salvar página</button> : <p className="text-xs text-[#817872]">{site.status === "IN_REVIEW" ? "Em revisão: a edição volta a ficar disponível após a decisão do administrador." : "Edição indisponível no status atual."}</p>}
  </form>;
}

export function SubmitSiteForm({ version, ready }: { version: number; ready: boolean }) {
  const [state, action, pending] = useActionState(submitOwnSiteAction, initial);
  return <form action={action} onSubmit={(event) => { if (!confirm("Enviar o site para revisão? Durante a revisão a página fica bloqueada para edição.")) event.preventDefault(); }}>
    <LoadingOverlay show={pending} label="Enviando solicitação…"/><input type="hidden" name="version" value={version}/>
    <button disabled={pending || !ready} className={primary}>Solicitar publicação</button>
    {!ready && <p className="mt-2 text-xs text-[#817872]">Disponível quando todos os itens obrigatórios estiverem completos.</p>}
    <AdminActionFeedback state={state}/>
  </form>;
}

/** Formulário de adição: envolve os cards de imóveis disponíveis (seleção múltipla ou individual). */
export function AddPropertiesForm({ children }: { children: React.ReactNode }) {
  const [state, action, pending] = useActionState(addPropertiesAction, initial);
  return <form action={action} className="space-y-4">
    <LoadingOverlay show={pending} label="Adicionando imóveis…"/>
    <AdminActionFeedback state={state}/>
    {children}
    <div className="sticky bottom-4 z-10 flex justify-end"><button name="bulk" value="1" disabled={pending} className="rounded-lg bg-[#302724] px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50">Adicionar selecionados</button></div>
  </form>;
}

type SelectionRowProps = { propertyId: string; title: string; subtitle: string; coverUrl: string | null; featured: boolean; eligible: boolean; canUp: boolean; canDown: boolean; canFeature: boolean };

/** Item da seleção: ordenar (↑/↓ dentro do grupo), destacar (máx. 6) e remover, com confirmação. */
export function SelectionRow({ propertyId, title, subtitle, coverUrl, featured, eligible, canUp, canDown, canFeature }: SelectionRowProps) {
  const [state, action, pending] = useActionState(manageSelectionAction, initial);
  const icon = "grid size-9 place-items-center rounded-lg border border-[#d8ccc3] text-[#5f5652] hover:bg-[#f7f2ee] disabled:opacity-30";
  return <li className="rounded-xl border border-[#ded5cd] bg-white p-3">
    <form action={action} className="space-y-3">
      <LoadingOverlay show={pending} label="Atualizando seleção…"/>
      <input type="hidden" name="propertyId" value={propertyId}/>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura da foto de destaque */}
        {coverUrl ? <img src={coverUrl} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover"/> : <div className="grid h-14 w-20 shrink-0 place-items-center rounded-md bg-[#eee7e1] text-[10px] text-[#8a817b]">Sem foto</div>}
        <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium">{title}</p><p className="truncate text-xs text-[#817872]">{subtitle}</p></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[11px]">{featured && <span className="rounded-full bg-[#f4ece6] px-2 py-0.5 text-[#66142e]">Destaque na home</span>}{!eligible && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-800">Indisponível na Maison — não aparece no site</span>}</div>
        <div className="ml-auto flex items-center gap-1.5">
        <button name="op" value="up" disabled={pending || !canUp} aria-label={`Mover ${title} para cima`} className={icon}><ArrowUp size={16}/></button>
        <button name="op" value="down" disabled={pending || !canDown} aria-label={`Mover ${title} para baixo`} className={icon}><ArrowDown size={16}/></button>
        <button name="op" value={featured ? "unfeature" : "feature"} disabled={pending || (!featured && !canFeature)} aria-pressed={featured} aria-label={featured ? `Remover destaque de ${title}` : `Destacar ${title}`} title={!featured && !canFeature ? "Limite de 6 destaques" : undefined} className={`${icon} ${featured ? "border-[#66142e] bg-[#66142e] text-white hover:bg-[#66142e]" : ""}`}><Star size={16}/></button>
        <button name="op" value="remove" disabled={pending} onClick={(event) => { if (!confirm(`Remover “${title}” do seu site? O imóvel continua na Maison.`)) event.preventDefault(); }} aria-label={`Remover ${title}`} className={`${icon} text-red-700`}><Trash2 size={16}/></button>
        </div>
      </div>
    </form>
    {(state.error || state.ok) && <div className="mt-2"><AdminActionFeedback state={state}/></div>}
  </li>;
}
