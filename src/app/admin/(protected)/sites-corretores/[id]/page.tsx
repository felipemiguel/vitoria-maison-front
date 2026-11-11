import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Eye } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { createBrokerServices } from "@/features/brokers/factory";
import { BrokerSiteNotFoundError } from "@/features/brokers/errors";
import { BROKER_SITE_STATUS_LABELS } from "@/features/brokers/status";
import { mediaPath } from "@/features/media/media-url";
import { ReviewDecisionForm, VerifyCreciForm, VistaCodeForm } from "@/components/admin/brokers/review-forms";

export const metadata = { title: "Revisar site de corretor" };
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value) : "—";

export default async function BrokerSiteReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("broker-site:manage-all");
  const { id } = await params;
  const { sites, profiles, subdomains } = createBrokerServices();
  let site;
  try { site = await sites.authorize(user, id, "read"); } catch (error) { if (error instanceof BrokerSiteNotFoundError) notFound(); throw error; }
  const [profile, readiness, selection] = await Promise.all([profiles.getById(user, site.brokerProfileId), sites.getReadiness(user, id), sites.listSelection(user, id)]);
  if (!profile) notFound();
  const card = "rounded-xl border border-[#ded5cd] bg-white p-5";
  const photo = profile.profileImageAssetId ? mediaPath(profile.profileImageAssetId) : profile.profileImageUrl;
  return <div className="mx-auto max-w-6xl space-y-6">
    <Link href="/admin/sites-corretores" className="inline-flex items-center gap-2 text-sm text-[#746c67]"><ArrowLeft size={16}/> Sites de corretores</Link>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">{profile.displayName}</h2><p className="mt-1 text-sm text-[#746c67]">{subdomains.publicUrl(site.subdomain) ?? site.subdomain} · {BROKER_SITE_STATUS_LABELS[site.status]}</p></div>
      <Link href={`/admin/sites-corretores/${id}/previa`} className="inline-flex items-center gap-2 rounded-lg border border-[#66142e] px-4 py-2 text-sm font-semibold text-[#66142e]"><Eye size={16}/> Abrir prévia</Link></div>
    {site.status === "SUSPENDED" && site.suspensionReason && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">Suspenso: {site.suspensionReason}</p>}
    {site.status === "DRAFT" && site.lastReviewDecision === "RETURNED" && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Devolvido em {date(site.lastReviewedAt)}: {site.lastReviewNotes}</p>}
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className={card}><h3 className="font-semibold">Perfil profissional</h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-[120px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element -- mídia já otimizada */}
            {photo ? <img src={photo} alt={`Foto de ${profile.displayName}`} className="aspect-[4/5] w-[120px] rounded-lg object-cover"/> : <div className="grid aspect-[4/5] w-[120px] place-items-center rounded-lg bg-[#ebe3dc] text-xs text-[#817872]">Sem foto</div>}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-[#817872]">Título</dt><dd>{profile.professionalTitle ?? "—"}</dd></div>
              <div><dt className="text-xs text-[#817872]">Contato</dt><dd className="break-all">{[profile.whatsapp && `WhatsApp ${profile.whatsapp}`, profile.phone && `Tel. ${profile.phone}`, profile.emailPublic].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt className="text-xs text-[#817872]">Especialidades</dt><dd>{profile.specialties.join(", ") || "—"}</dd></div>
              <div><dt className="text-xs text-[#817872]">Regiões</dt><dd>{profile.serviceRegions.join(", ") || "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-[#817872]">Biografia</dt><dd className="whitespace-pre-line">{profile.biography ?? "—"}</dd></div>
            </dl>
          </div>
        </section>
        <section className={card}><h3 className="font-semibold">Página inicial</h3>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-xs text-[#817872]">Título principal</dt><dd>{site.headline ?? "—"}</dd></div>
            <div><dt className="text-xs text-[#817872]">Subtítulo</dt><dd>{site.subtitle ?? "—"}</dd></div>
            <div><dt className="text-xs text-[#817872]">Texto de introdução</dt><dd className="whitespace-pre-line">{(site.settings?.introText as string | undefined) ?? "—"}</dd></div>
            <div><dt className="text-xs text-[#817872]">Texto de atendimento</dt><dd className="whitespace-pre-line">{(site.settings?.serviceText as string | undefined) ?? "—"}</dd></div>
          </dl>
        </section>
        <section className={card}><h3 className="font-semibold">Imóveis selecionados ({selection.length})</h3>
          {selection.length === 0 ? <p className="mt-3 text-sm text-[#746c67]">Nenhum imóvel selecionado.</p> : <ul className="mt-4 divide-y divide-[#f1ebe6]">{selection.map((item) => <li key={item.curatedPropertyId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span><span className="font-medium">{item.title}</span> <span className="text-xs text-[#817872]">· {item.vistaCode} · {[item.neighborhood, item.city].filter(Boolean).join(", ")}</span></span><span className="flex gap-2 text-xs">{item.featured && <span className="rounded-full bg-[#f4ece6] px-2 py-0.5 text-[#66142e]">Destaque</span>}<span className={`rounded-full px-2 py-0.5 ${item.eligible ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{item.eligible ? "Visível" : "Indisponível na Maison"}</span></span></li>)}</ul>}
        </section>
      </div>
      <aside className="space-y-6">
        <section className={card}><h3 className="font-semibold">Completude: {readiness.completed}/{readiness.total}</h3>
          <ul className="mt-3 space-y-2 text-sm">{readiness.items.map((item) => <li key={item.key} className={`flex gap-2 ${item.done ? "text-[#302724]" : "text-red-700"}`}>{item.done ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700"/> : <Circle size={16} className="mt-0.5 shrink-0"/>}{item.label}</li>)}</ul></section>
        <section className={card}><h3 className="font-semibold">CRECI</h3><p className="mt-2 text-sm">{profile.creci ?? "Não informado"} {profile.creci && <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${profile.creciVerifiedAt ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{profile.creciVerifiedAt ? `Verificado em ${date(profile.creciVerifiedAt)}` : "Aguardando verificação"}</span>}</p>
          {profile.creci && !profile.creciVerifiedAt && <div className="mt-3"><VerifyCreciForm profileId={profile.id} siteId={id}/></div>}
          <p className="mt-2 text-xs text-[#817872]">Confira o número no cadastro oficial do CRECI antes de verificar.</p></section>
        <section className={card}><h3 className="font-semibold">Código no Vista</h3><p className="mt-1 text-xs text-[#817872]">Somente administradores configuram. Usado na futura atribuição de leads (6.4D).</p><div className="mt-3"><VistaCodeForm profileId={profile.id} siteId={id} current={profile.vistaBrokerCode}/></div></section>
        <section className={card}><h3 className="font-semibold">Decisão</h3><div className="mt-3"><ReviewDecisionForm id={id} version={site.version} status={site.status} ready={readiness.ready}/></div></section>
      </aside>
    </div>
  </div>;
}
