import Link from "next/link";
import { MessageCircle, Mail } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { listMyLeads } from "@/features/brokers/my-leads";
import { formatPhone } from "@/features/brokers/contact";
import { LEAD_ASSIGNMENT_HELP, LEAD_ASSIGNMENT_LABELS, LEAD_DELIVERY_LABELS, LEAD_TYPE_LABELS, assignmentBadgeClass, deliveryBadgeClass } from "@/features/leads/labels";
import type { LeadAssignmentStatus, LeadDeliveryStatus } from "@/features/leads/types";

export const metadata = { title: "Meus leads" };

const DELIVERY: LeadDeliveryStatus[] = ["DELIVERED", "PENDING", "UNKNOWN", "FAILED", "MOCKED"];
const ASSIGNMENT: LeadAssignmentStatus[] = ["UNVERIFIED", "CONFIRMED", "MISMATCH", "PENDING"];
const pick = <T extends string>(value: string | undefined, values: T[]) => values.includes(value as T) ? value as T : undefined;
const day = (value?: string) => { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined; const parsed = new Date(`${value}T00:00:00-03:00`); return Number.isNaN(parsed.getTime()) ? undefined : parsed; };
const nextDay = (value?: string) => { const parsed = day(value); if (parsed) parsed.setDate(parsed.getDate() + 1); return parsed; };
const when = (value: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);

/**
 * Leads recebidos pelo site do próprio corretor. Consulta e acompanhamento da integração (não é um CRM).
 * O escopo vem da sessão (site E usuário); filtros apenas restringem.
 */
export default async function MyLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePagePermission("broker-site:read-own", "leads:read-own");
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.pagina ?? "1", 10) || 1);
  const code = query.imovel?.trim().slice(0, 80) || undefined;
  const data = await listMyLeads(user, { status: pick(query.entrega, DELIVERY), assignment: pick(query.atribuicao, ASSIGNMENT), vistaCode: code, from: day(query.de), to: nextDay(query.ate), page, pageSize: 20 });
  const card = "rounded-xl border border-[#ded5cd] bg-white";
  if (!data) return <section className={`${card} p-6 text-sm text-[#746c67]`}>Crie seu site para começar a receber contatos.</section>;
  const params = (target: number) => { const next = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1]))); next.set("pagina", String(target)); return `?${next}`; };
  return <div className="space-y-5">
    <div><h3 className="text-lg font-semibold">Meus leads</h3><p className="mt-1 text-sm text-[#746c67]">Pessoas que enviaram o formulário do seu site. Cliques no WhatsApp não aparecem aqui, porque a conversa acontece direto no seu WhatsApp.</p></div>
    <form className={`${card} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5`}>
      <label className="text-xs text-[#746c67]">Código do imóvel<input name="imovel" defaultValue={query.imovel} className="mt-1 h-10 w-full rounded-lg border border-[#d8ccc3] px-3 text-sm"/></label>
      <label className="text-xs text-[#746c67]">Entrega<select name="entrega" defaultValue={query.entrega ?? ""} className="mt-1 h-10 w-full rounded-lg border border-[#d8ccc3] bg-white px-3 text-sm"><option value="">Todas</option>{DELIVERY.map((value) => <option key={value} value={value}>{LEAD_DELIVERY_LABELS[value]}</option>)}</select></label>
      <label className="text-xs text-[#746c67]">Atribuição no Vista<select name="atribuicao" defaultValue={query.atribuicao ?? ""} className="mt-1 h-10 w-full rounded-lg border border-[#d8ccc3] bg-white px-3 text-sm"><option value="">Todas</option>{ASSIGNMENT.map((value) => <option key={value} value={value}>{LEAD_ASSIGNMENT_LABELS[value]}</option>)}</select></label>
      <label className="text-xs text-[#746c67]">De<input type="date" name="de" defaultValue={query.de} className="mt-1 h-10 w-full rounded-lg border border-[#d8ccc3] px-3 text-sm"/></label>
      <label className="text-xs text-[#746c67]">Até<input type="date" name="ate" defaultValue={query.ate} className="mt-1 h-10 w-full rounded-lg border border-[#d8ccc3] px-3 text-sm"/></label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end"><Link href="/admin/meu-site/leads" className="grid h-10 place-items-center rounded-lg border border-[#d8ccc3] px-4 text-sm">Limpar</Link><button className="h-10 rounded-lg bg-[#302724] px-5 text-sm font-semibold text-white">Filtrar</button></div>
    </form>
    <p className="text-sm text-[#746c67]">{data.total} {data.total === 1 ? "lead" : "leads"}</p>
    <ul className="space-y-3">{data.items.map((lead) => {
      const phone = formatPhone(lead.phone) ?? lead.phone;
      const digits = lead.phone?.replace(/\D/g, "") ?? "";
      return <li key={lead.id} className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><p className="font-semibold">{lead.name}</p><p className="mt-0.5 text-xs text-[#746c67]">{when(lead.createdAt)} · {LEAD_TYPE_LABELS[lead.type]} · {lead.sourceHostname ? `${lead.sourceHostname}${lead.sourcePath && lead.sourcePath !== "/" ? lead.sourcePath : ""}` : `Seu site${lead.sourcePath && lead.sourcePath !== "/" ? ` · ${lead.sourcePath}` : ""}`}</p></div>
          <div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${deliveryBadgeClass(lead.deliveryStatus)}`}>{LEAD_DELIVERY_LABELS[lead.deliveryStatus]}</span><span title={LEAD_ASSIGNMENT_HELP[lead.assignmentStatus]} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${assignmentBadgeClass(lead.assignmentStatus)}`}>Atribuição: {LEAD_ASSIGNMENT_LABELS[lead.assignmentStatus]}</span></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {phone && <a href={digits.length >= 10 ? `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}` : `tel:${digits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#66142e]"><MessageCircle size={15} aria-hidden/>{phone}</a>}
          {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 break-all text-[#66142e]"><Mail size={15} aria-hidden/>{lead.email}</a>}
        </div>
        {lead.propertyVistaCode && <p className="mt-2 text-sm"><span className="text-[#746c67]">Imóvel:</span> {lead.propertyTitle ?? "—"} <span className="text-[#746c67]">· código {lead.propertyVistaCode}</span></p>}
        {lead.message && <p className="mt-2 whitespace-pre-line rounded-lg bg-[#f8f6f2] p-3 text-sm text-[#4f4743]">{lead.message}</p>}
        <p className="mt-2 text-xs text-[#817872]">{lead.vistaReference ? `Código do lead no Vista: ${lead.vistaReference}` : "Código no Vista ainda não disponível."} {LEAD_ASSIGNMENT_HELP[lead.assignmentStatus]}</p>
      </li>;
    })}{!data.items.length && <li className={`${card} p-10 text-center text-sm text-[#817872]`}>Nenhum lead encontrado.</li>}</ul>
    {data.pages > 1 && <nav aria-label="Paginação dos leads" className="flex items-center justify-center gap-4 text-sm">
      <Link aria-disabled={data.page <= 1} href={params(data.page - 1)} className={`rounded-lg border border-[#d8ccc3] bg-white px-4 py-2 ${data.page <= 1 ? "pointer-events-none opacity-40" : ""}`}>← Anterior</Link>
      <span>Página {data.page} de {data.pages}</span>
      <Link aria-disabled={data.page >= data.pages} href={params(data.page + 1)} className={`rounded-lg border border-[#d8ccc3] bg-white px-4 py-2 ${data.page >= data.pages ? "pointer-events-none opacity-40" : ""}`}>Próxima →</Link>
    </nav>}
  </div>;
}
