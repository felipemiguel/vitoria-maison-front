import { requirePagePermission } from "@/features/access/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/features/access/permissions";
import { LeadRetryForm } from "@/components/admin/lead-retry-form";
import { LeadAssignmentForm, LeadReconcileForm } from "@/components/admin/lead-reconcile-forms";
import { createLeadServices } from "@/features/leads/factory";
import { LEAD_ASSIGNMENT_HELP, LEAD_ASSIGNMENT_LABELS, LEAD_DELIVERY_LABELS, LEAD_SOURCE_LABELS, LEAD_TYPE_LABELS, assignmentBadgeClass, deliveryBadgeClass } from "@/features/leads/labels";

export default async function AdminLeadDetail({params}:{params:Promise<{id:string}>}){
  const user=await requirePagePermission("leads:read");const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  const data=await createLeadServices().store.get(id);if(!data)notFound();
  const lead=data.lead;const canManage=hasPermission(user,"leads:manage");
  const stuck=data.stalePending;
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/admin/leads" className="text-sm font-semibold text-[#66142e]">← Voltar aos leads</Link>
    <div><h2 className="text-2xl font-semibold">Solicitação de {lead.name}</h2><p className="mt-1 text-sm text-[#746c67]">Recebida em {formatDate(lead.createdAt)}</p></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="rounded-xl border border-[#ded5cd] bg-white p-6"><h3 className="font-semibold">Dados para atendimento</h3><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Item label="Nome" value={lead.name}/><Item label="E-mail" value={lead.email}/><Item label="Telefone" value={lead.phone}/><Item label="Tipo" value={LEAD_TYPE_LABELS[lead.type]}/><Item label="Código do imóvel" value={lead.propertyVistaCode}/><Item label="Anúncio (enviado ao Vista)" value={lead.sourcePage}/><div className="sm:col-span-2"><Item label="Mensagem" value={lead.message}/></div></dl></section>
        <section className="rounded-xl border border-[#ded5cd] bg-white p-6"><h3 className="font-semibold">Origem</h3><dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <Item label="Canal" value={LEAD_SOURCE_LABELS[lead.source]}/>
          <Item label="Endereço de origem" value={lead.sourceHostname?`${lead.sourceHostname}${lead.sourcePath&&lead.sourcePath!=="/"?lead.sourcePath:""}`:null}/>
          {lead.source==="BROKER_SITE"&&<><Item label="Corretor" value={data.broker?.displayName??"Site removido"}/><Item label="Site atual" value={data.broker?.subdomain??null}/><Item label="Código Vista esperado do corretor" value={lead.vistaBrokerCodeRequested}/><Item label="Corretor informado pelo Vista" value={lead.vistaBrokerCodeReturned}/></>}
        </dl>{lead.source==="BROKER_SITE"&&<p className="mt-4 text-xs leading-5 text-[#746c67]">A origem é registrada no envio e não muda, mesmo que o corretor troque o endereço do site.</p>}</section>
      </div>
      <aside className="space-y-5">
        <section className="rounded-xl border border-[#ded5cd] bg-white p-5"><h3 className="font-semibold">Entrega ao Vista</h3>
          <p className="mt-3 text-sm">Situação: <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${deliveryBadgeClass(lead.deliveryStatus)}`}>{LEAD_DELIVERY_LABELS[lead.deliveryStatus]}</span></p>
          <p className="mt-2 text-sm">Tentativas: {lead.attempts}</p><p className="mt-2 text-sm">Código do lead no Vista: {lead.vistaReference??"—"}</p><p className="mt-2 text-sm">Último erro: {lead.lastErrorCode??"—"}</p>
          {canManage&&lead.deliveryStatus==="FAILED"&&<div className="mt-5"><LeadRetryForm id={lead.id}/></div>}
          {(lead.deliveryStatus==="UNKNOWN"||stuck)&&<div className="mt-5 space-y-3"><p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Resultado indeterminado. Procure o lead no Vista (nome, telefone e horário) antes de qualquer nova tentativa, para evitar duplicação.</p>{canManage&&<LeadReconcileForm id={lead.id}/>}</div>}
        </section>
        {lead.source==="BROKER_SITE"&&<section className="rounded-xl border border-[#ded5cd] bg-white p-5"><h3 className="font-semibold">Atribuição ao corretor</h3>
          <p className="mt-3 text-sm"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${assignmentBadgeClass(lead.assignmentStatus)}`}>{LEAD_ASSIGNMENT_LABELS[lead.assignmentStatus]}</span></p>
          <p className="mt-3 text-xs leading-5 text-[#746c67]">{LEAD_ASSIGNMENT_HELP[lead.assignmentStatus]}</p>
          {lead.assignmentCheckedAt&&<p className="mt-2 text-xs text-[#746c67]">Conferido em {formatDate(lead.assignmentCheckedAt)}.</p>}
          {canManage&&lead.deliveryStatus==="DELIVERED"&&<div className="mt-4 border-t border-[#f1ebe6] pt-4"><p className="mb-3 text-xs leading-5 text-[#746c67]">Confira no Vista com quem o lead ficou. Cliente já cadastrado pode continuar com o corretor anterior: a troca de responsável é uma decisão comercial feita no Vista.</p><LeadAssignmentForm id={lead.id}/></div>}
        </section>}
      </aside>
    </div>
    <section className="rounded-xl border border-[#ded5cd] bg-white p-6"><h3 className="font-semibold">Histórico de entrega</h3><div className="mt-4 divide-y divide-[#eee7e1]">{data.attempts.map((attempt)=><div key={attempt.id} className="grid gap-2 py-3 text-sm sm:grid-cols-5"><span>{formatDate(attempt.attemptedAt)}</span><b>{LEAD_DELIVERY_LABELS[attempt.status]}</b><span>{attempt.errorCode==="MANUAL_RECONCILIATION"?"Conferência manual":`${attempt.durationMs} ms`}</span><span>{attempt.errorCode&&attempt.errorCode!=="MANUAL_RECONCILIATION"?attempt.errorCode:"—"}</span><span>{attempt.vistaReference?`Vista ${attempt.vistaReference}`:""}{attempt.vistaBrokerCodeReturned?` · corretor ${attempt.vistaBrokerCodeReturned}`:""}</span></div>)}{!data.attempts.length&&<p className="py-5 text-sm text-[#746c67]">Nenhuma tentativa registrada.</p>}</div></section>
  </div>;
}
function Item({label,value}:{label:string;value:string|null}){return <div><dt className="text-xs uppercase tracking-[.08em] text-[#817872]">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value||"—"}</dd></div>}
function formatDate(value:Date){return new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(value)}
