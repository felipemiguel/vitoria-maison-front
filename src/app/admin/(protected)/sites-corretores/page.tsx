import Link from "next/link";
import { requirePagePermission } from "@/features/access/server";
import { createBrokerServices } from "@/features/brokers/factory";
import { getBrokerSitesConfig } from "@/features/brokers/config";
import { BROKER_SITE_STATUS_LABELS } from "@/features/brokers/status";
import type { BrokerSiteStatus } from "@/database/schema";
import { EmptyState } from "@/components/admin/empty-state";

export const metadata = { title: "Sites de corretores" };
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(value) : "—";
const TABS: (BrokerSiteStatus | "ALL")[] = ["IN_REVIEW", "PUBLISHED", "DRAFT", "SUSPENDED", "ALL"];
const STATUS_STYLE: Record<BrokerSiteStatus, string> = { IN_REVIEW: "bg-amber-50 text-amber-900", PUBLISHED: "bg-emerald-50 text-emerald-800", DRAFT: "bg-[#f4ece6] text-[#66142e]", SUSPENDED: "bg-red-50 text-red-800" };

export default async function BrokerSitesAdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePagePermission("broker-site:manage-all");
  const { sites, subdomains } = createBrokerServices();
  const all = await sites.listAll(user);
  const requested = (await searchParams).status;
  const tab = TABS.includes(requested as BrokerSiteStatus) ? (requested as BrokerSiteStatus) : (all.some((site) => site.status === "IN_REVIEW") ? "IN_REVIEW" : "ALL");
  const items = tab === "ALL" ? all : all.filter((site) => site.status === tab);
  const count = (status: BrokerSiteStatus | "ALL") => status === "ALL" ? all.length : all.filter((site) => site.status === status).length;
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><h2 className="text-2xl font-semibold">Sites de corretores</h2><p className="mt-1 text-sm text-[#746c67]">Revise solicitações de publicação, acompanhe os sites publicados e suspenda quando necessário.</p></div>
    {!getBrokerSitesConfig().enabled && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">BROKER_SITES_ENABLED está desligado: nenhum subdomínio responde publicamente neste ambiente, mesmo para sites aprovados.</p>}
    <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">{TABS.map((status) => <Link key={status} href={`/admin/sites-corretores?status=${status}`} aria-current={tab === status ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm ${tab === status ? "border-[#66142e] bg-[#66142e] text-white" : "border-[#d8ccc3] bg-white"}`}>{status === "ALL" ? "Todos" : BROKER_SITE_STATUS_LABELS[status]} <span className="opacity-70">({count(status)})</span></Link>)}</nav>
    {items.length === 0 ? <EmptyState title="Nenhum site neste status" description="Os corretores criam e enviam os sites em “Meu site”."/> : <div className="grid gap-3">{items.map((site) => <Link key={site.id} href={`/admin/sites-corretores/${site.id}`} className="grid gap-3 rounded-xl border border-[#ded5cd] bg-white p-4 hover:border-[#66142e] sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{site.displayName}</span><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[site.status]}`}>{BROKER_SITE_STATUS_LABELS[site.status]}</span></div>
        <p className="mt-1 truncate text-xs text-[#746c67]">{site.ownerEmail} · {subdomains.publicUrl(site.subdomain) ?? site.subdomain}</p>
        <p className="mt-1 text-xs text-[#817872]">Enviado: {date(site.submittedForReviewAt)} · Publicado: {date(site.publishedAt)} · Atualizado: {date(site.updatedAt)}</p></div>
      <span className="text-sm font-semibold text-[#66142e]">{site.status === "IN_REVIEW" ? "Revisar →" : "Abrir →"}</span>
    </Link>)}</div>}
  </div>;
}
