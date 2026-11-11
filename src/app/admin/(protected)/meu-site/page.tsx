import Link from "next/link";
import { CheckCircle2, Circle, Eye } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { createBrokerServices } from "@/features/brokers/factory";
import { getBrokerSitesConfig } from "@/features/brokers/config";
import { loadMySite } from "@/features/brokers/my-site";
import { myLeadStats } from "@/features/brokers/my-leads";
import { BROKER_SITE_STATUS_LABELS } from "@/features/brokers/status";
import { normalizeSubdomainCandidate } from "@/features/brokers/subdomain-rules";
import { MAX_FEATURED_PROPERTIES, MAX_SELECTED_PROPERTIES } from "@/features/brokers/broker-site-service";
import { CreateSiteForm, SubmitSiteForm } from "@/components/admin/brokers/broker-forms";

export const metadata = { title: "Meu site" };
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value) : "—";

export default async function MySiteDashboard() {
  const user = await requirePagePermission("broker-site:read-own");
  const { profile, site, readiness, selection } = await loadMySite(user);
  const { subdomains } = createBrokerServices();
  const card = "rounded-xl border border-[#ded5cd] bg-white p-5 sm:p-6";
  if (!profile) return <section className={card}><h3 className="font-semibold">Comece pelo perfil profissional</h3><p className="mt-2 text-sm text-[#746c67]">Seu nome, sua foto e seus contatos aparecem no site. Depois disso, você escolhe o endereço e os imóveis.</p><Link href="/admin/meu-site/perfil" className="mt-5 inline-flex rounded-lg bg-[#66142e] px-5 py-2.5 text-sm font-semibold text-white">Criar perfil profissional</Link></section>;
  if (!site) {
    const suggestion = (await subdomains.suggest(profile.displayName, 1))[0] ?? normalizeSubdomainCandidate(profile.displayName);
    return <section className={card}><h3 className="font-semibold">Crie seu site</h3><p className="mt-1 text-sm text-[#746c67]">Escolha o endereço. Você poderá mudar enquanto o site estiver em rascunho.</p><div className="mt-5"><CreateSiteForm suggestion={suggestion} baseDomain={getBrokerSitesConfig().baseDomain}/></div></section>;
  }
  const stats = await myLeadStats(user);
  const featured = selection.filter((item) => item.featured).length;
  const visible = selection.filter((item) => item.eligible).length;
  const percent = readiness ? Math.round((readiness.completed / readiness.total) * 100) : 0;
  return <div className="space-y-6">
    {site.status === "DRAFT" && site.lastReviewDecision === "RETURNED" && site.lastReviewNotes && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Solicitação devolvida em {date(site.lastReviewedAt)}</p><p className="mt-1 whitespace-pre-line">{site.lastReviewNotes}</p><p className="mt-2 text-xs">Faça os ajustes e solicite a publicação novamente.</p></div>}
    {site.status === "IN_REVIEW" && <p role="status" className="rounded-xl border border-[#e4dcd5] bg-white p-4 text-sm text-[#5f5652]">Seu site está em revisão desde {date(site.submittedForReviewAt)}. A página fica bloqueada para edição até a decisão; a seleção de imóveis continua disponível.</p>}
    {site.status === "SUSPENDED" && <p role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Site suspenso{site.suspensionReason ? `: ${site.suspensionReason}` : "."} Fale com a equipe Vitória Maison.</p>}
    <section className={`${card} grid gap-5 sm:grid-cols-2 lg:grid-cols-4`}>
      <div><p className="text-xs text-[#817872]">Nome profissional</p><p className="mt-1 font-medium">{profile.displayName}</p></div>
      <div><p className="text-xs text-[#817872]">Endereço</p><p className="mt-1 break-all font-medium">{subdomains.publicUrl(site.subdomain) ?? site.subdomain}</p></div>
      <div><p className="text-xs text-[#817872]">Status</p><p className="mt-1 font-medium">{BROKER_SITE_STATUS_LABELS[site.status]}</p></div>
      <div><p className="text-xs text-[#817872]">Última atualização</p><p className="mt-1 font-medium">{date(site.updatedAt)}</p></div>
      <div><p className="text-xs text-[#817872]">Imóveis selecionados</p><p className="mt-1 font-medium">{selection.length} de {MAX_SELECTED_PROPERTIES} <span className="text-xs font-normal text-[#817872]">({visible} visíveis)</span></p></div>
      <div><p className="text-xs text-[#817872]">Destaques na home</p><p className="mt-1 font-medium">{featured} de {MAX_FEATURED_PROPERTIES}</p></div>
      <div className="sm:col-span-2 flex items-end"><Link href="/admin/meu-site/previa" className="inline-flex items-center gap-2 rounded-lg border border-[#66142e] px-4 py-2 text-sm font-semibold text-[#66142e]"><Eye size={16}/> Abrir prévia</Link></div>
    </section>
    {stats && <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Leads do site</h3><Link href="/admin/meu-site/leads" className="text-sm font-semibold text-[#66142e]">Ver leads →</Link></div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {([["Total recebido", stats.total], ["Últimos 30 dias", stats.last30], ["Entregues ao Vista", stats.delivered], ["Atribuição a conferir", stats.assignmentPending], ["Divergências", stats.mismatch]] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-[#817872]">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd></div>)}
      </dl>
      {stats.byProperty.length > 0 && <div className="mt-5 border-t border-[#f1ebe6] pt-4"><p className="text-xs text-[#817872]">Leads por imóvel</p><ul className="mt-2 space-y-1 text-sm">{stats.byProperty.map((item) => <li key={item.code} className="flex justify-between gap-4"><span className="truncate">{item.title ?? "Imóvel"} <span className="text-[#817872]">· {item.code}</span></span><span className="tabular-nums">{item.total}</span></li>)}</ul></div>}
      <p className="mt-4 text-xs text-[#817872]">Somente formulários enviados. Cliques no WhatsApp não são contados.</p>
    </section>}
    {readiness && <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Completude da configuração</h3><span className="text-sm text-[#746c67]">{readiness.completed} de {readiness.total} · {percent}%</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eee7e1]" role="progressbar" aria-valuemin={0} aria-valuemax={readiness.total} aria-valuenow={readiness.completed} aria-label="Completude"><div className="h-full bg-[#66142e]" style={{ width: `${percent}%` }}/></div>
      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{readiness.items.map((item) => <li key={item.key} className={`flex gap-2 ${item.done ? "text-[#302724]" : "text-[#9a4b2f]"}`}>{item.done ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700"/> : <Circle size={16} className="mt-0.5 shrink-0"/>}{item.label}</li>)}</ul>
      {site.status === "DRAFT" && <div className="mt-6 border-t border-[#f1ebe6] pt-5"><SubmitSiteForm version={site.version} ready={readiness.ready}/></div>}
    </section>}
  </div>;
}
