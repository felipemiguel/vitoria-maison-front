import { redirect } from "next/navigation";
import { requirePageUser } from "@/features/access/server";
import { hasPermission } from "@/features/access/permissions";
import { homePathFor } from "@/features/access/navigation";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { PropertyTable } from "@/components/admin/property-table";
import { StatCard } from "@/components/admin/stat-card";
import { PropertyStatusBadge } from "@/components/admin/property-status-badge";
import { getAuthorizedAdminPropertyService } from "@/features/admin/properties/admin-property-service-factory";

export const metadata = { title: "Visão geral administrativa" };

export default async function AdminDashboardPage() {
  // Usuários sem acesso operacional (ex.: somente BROKER) vão para a área pessoal.
  const user = await requirePageUser();
  if (!hasPermission(user, "properties:read")) redirect(homePathFor(user));
  const stats = await (await getAuthorizedAdminPropertyService("properties:read")).getDashboardStats();
  return <div className="mx-auto max-w-[1500px] space-y-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-[#746c67]">Visão operacional da curadoria e sincronização.</p></div><Link href="/admin/vista" className="flex items-center gap-2 rounded-lg bg-[#66142e] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d3a865] focus-visible:ring-offset-2"><Search size={17}/> Explorar imóveis do Vista</Link></div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><StatCard label="Selecionados" value={stats.selected}/><StatCard label="Aprovados" value={stats.published} hint="Flag editorial"/><StatCard label="Rascunhos" value={stats.drafts}/><StatCard label="Visíveis no site" value={stats.publiclyEligible} hint="Elegíveis agora"/><StatCard label="Disponibilidade pendente" value={stats.availabilityAttention}/><StatCard label="Erros de sincronização" value={stats.syncErrors}/></section>
    <section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Imóveis adicionados recentemente</h2><Link href="/admin/imoveis" className="flex items-center gap-1 text-sm font-medium text-[#66142e]">Ver todos <ArrowRight size={15}/></Link></div><PropertyTable items={stats.latestProperties}/></section>
    <section className="rounded-xl border border-[#ded5cd] bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Últimas sincronizações</h2>{stats.latestSync&&<PropertyStatusBadge value={stats.latestSync.status}/>}</div>{stats.latestSyncRuns.length?<div className="mt-4 divide-y divide-[#eee7e1]">{stats.latestSyncRuns.map(run=><div key={run.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto_auto]"><div><PropertyStatusBadge value={run.status}/><span className="ml-3 text-[#746c67]">{formatDate(run.startedAt)}</span></div><span>{run.totalSuccess} sucesso(s)</span><span className={run.totalFailed?"text-red-700":"text-[#746c67]"}>{run.totalFailed} falha(s)</span></div>)}</div>:<p className="mt-4 text-sm text-[#746c67]">Nenhuma sincronização registrada.</p>}</section>
  </div>;
}

function formatDate(value: Date): string { return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(value); }
