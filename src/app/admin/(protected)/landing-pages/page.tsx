import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { createLandingPageService } from "@/features/landing-pages/factory";
import { LANDING_PAGE_STATUS_LABELS } from "@/features/landing-pages/landing-page-service";
import type { LandingPageStatus } from "@/database/schema";
import { EmptyState } from "@/components/admin/empty-state";
import { CreateLandingPageForm } from "@/components/admin/landing-pages/landing-forms";
import { LandingStatusBadge } from "@/components/admin/landing-pages/status-badge";

export const metadata = { title: "Landing pages" };
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(value) : "—";
const TABS: (LandingPageStatus | "ALL")[] = ["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"];

export default async function LandingPagesAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePagePermission("landing-pages:manage");
  const all = await createLandingPageService().list(user);
  const requested = (await searchParams).status;
  const tab = TABS.includes(requested as LandingPageStatus) ? requested as LandingPageStatus | "ALL" : "ALL";
  const items = tab === "ALL" ? all.filter((item) => item.status !== "ARCHIVED") : all.filter((item) => item.status === tab);
  const broken = all.filter((item) => item.status === "PUBLISHED" && !item.propertyVisible);
  const count = (status: LandingPageStatus | "ALL") => status === "ALL" ? all.filter((item) => item.status !== "ARCHIVED").length : all.filter((item) => item.status === status).length;
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><h2 className="text-2xl font-semibold">Landing pages</h2><p className="mt-1 text-sm text-[#746c67]">Páginas de venda de um imóvel para anúncios e divulgação, com contato pelo WhatsApp. Ficam fora do Google.</p></div>
    <CreateLandingPageForm/>
    {broken.length > 0 && <div role="alert" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><p><b>{broken.length} página(s) publicada(s) com imóvel indisponível.</b> Elas mostram “imóvel não está mais disponível” e sugerem outros imóveis. Pause as campanhas que apontam para elas.</p></div>}
    <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">{TABS.map((status) => <Link key={status} href={`/admin/landing-pages?status=${status}`} aria-current={tab === status ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm ${tab === status ? "border-[#66142e] bg-[#66142e] text-white" : "border-[#d8ccc3] bg-white"}`}>{status === "ALL" ? "Ativas" : LANDING_PAGE_STATUS_LABELS[status]} <span className="opacity-70">({count(status)})</span></Link>)}</nav>
    {items.length === 0 ? <EmptyState title="Nenhuma landing page aqui" description="Crie uma página informando o código do imóvel no Vista."/> : <div className="grid gap-3">{items.map((item) => <Link key={item.id} href={`/admin/landing-pages/${item.id}`} className="grid gap-3 rounded-xl border border-[#ded5cd] bg-white p-4 hover:border-[#66142e] sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.name}</span><LandingStatusBadge status={item.status}/>{!item.propertyVisible && item.status !== "ARCHIVED" && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">Imóvel indisponível</span>}</div>
        <p className="mt-1 truncate text-xs text-[#746c67]">/lp/{item.slug} · {item.propertyCode} — {item.propertyTitle}</p>
        <p className="mt-1 text-xs text-[#817872]">Publicada em: {date(item.publishedAt)} · Atualizada: {date(item.updatedAt)}</p>
      </div>
      <span className="text-sm font-semibold text-[#66142e]">Editar →</span>
    </Link>)}</div>}
  </div>;
}
