import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Eye } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { createLandingPageService } from "@/features/landing-pages/factory";
import { LandingPageNotFoundError } from "@/features/landing-pages/landing-page-service";
import { getSeoConfig } from "@/features/seo/config";
import { contactConfig } from "@/lib/config/contact";
import { BlocksEditor } from "@/components/admin/landing-pages/blocks-editor";
import { LandingHeroUpload, LandingLinkBuilder, LandingSettingsForm, LandingStatusActions } from "@/components/admin/landing-pages/landing-forms";
import { LandingStatusBadge } from "@/components/admin/landing-pages/status-badge";

export const metadata = { title: "Editar landing page" };

async function publicOrigin(): Promise<string> {
  const configured = getSeoConfig().siteUrl;
  if (configured) return configured.origin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-[#ded5cd] bg-white p-5"><h3 className="text-lg font-semibold">{title}</h3>{description && <p className="mt-1 text-sm text-[#746c67]">{description}</p>}<div className="mt-5">{children}</div></section>;
}

export default async function LandingPageEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criada?: string; copia?: string }> }) {
  const user = await requirePagePermission("landing-pages:manage");
  const { id } = await params;
  const page = await createLandingPageService().get(user, id).catch((error) => { if (error instanceof LandingPageNotFoundError) notFound(); throw error; });
  const flags = await searchParams;
  const url = `${await publicOrigin()}/lp/${page.slug}`;
  const archived = page.status === "ARCHIVED";
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <Link href="/admin/landing-pages" className="text-sm text-[#746c67]">← Landing pages</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold">{page.name}</h2><LandingStatusBadge status={page.status}/></div>
        <p className="mt-1 text-sm text-[#746c67]">Imóvel {page.propertyCode} — {page.propertyTitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/landing-pages/${page.id}/previa`} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccc3] bg-white px-4 py-2.5 text-sm font-semibold"><Eye size={16}/> Prévia</Link>
        {page.status === "PUBLISHED" && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccc3] bg-white px-4 py-2.5 text-sm font-semibold"><ExternalLink size={16}/> Abrir página</a>}
      </div>
    </div>

    {(flags.criada || flags.copia) && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flags.copia ? "Cópia criada em rascunho, com novo endereço." : "Página criada em rascunho, com os blocos preenchidos com os dados do imóvel. Revise os textos, veja a prévia e publique."}</p>}
    {!page.property && <div role="alert" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><p><b>O imóvel não está visível no catálogo público.</b> {page.status === "PUBLISHED" ? "A página publicada mostra \"imóvel não está mais disponível\" e sugere outros imóveis. Pause as campanhas." : "Não é possível publicar até o imóvel voltar ao catálogo."}</p></div>}

    <Card title="Publicação" description={page.status === "PUBLISHED" ? "A página está no ar. Alterações salvas aparecem imediatamente." : "Rascunhos e páginas arquivadas respondem 404 para o público."}>
      {page.status === "DRAFT" && <ul className="mb-4 space-y-1.5 text-sm">{page.readiness.ready
        ? <li className="flex items-center gap-2 text-emerald-800"><CheckCircle2 size={16}/> Pronta para publicar.</li>
        : page.readiness.missing.map((item) => <li key={item} className="flex gap-2 text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0"/> {item}</li>)}</ul>}
      <LandingStatusActions id={page.id} version={page.version} status={page.status} ready={page.readiness.ready}/>
    </Card>

    {page.status === "PUBLISHED" && <Card title="Link para anúncios" description="Monte o link com UTMs para saber de onde vem cada visita no Google Analytics (quando habilitado). O endereço base nunca muda.">
      <LandingLinkBuilder url={url}/>
    </Card>}

    <Card title="Configurações" description="Nome interno, endereço, WhatsApp e textos de compartilhamento do link.">
      <LandingSettingsForm page={{ id: page.id, version: page.version, name: page.name, slug: page.slug, slugLocked: page.slugLocked, whatsappNumber: page.pageWhatsappNumber, whatsappMessage: page.whatsappMessage, seoTitle: page.seoTitle, seoDescription: page.seoDescription, defaultWhatsapp: contactConfig.whatsappNumber || null, archived }}/>
    </Card>

    <Card title="Imagem de topo">
      <LandingHeroUpload id={page.id} currentUrl={page.heroImageUrl} fallbackUrl={page.property?.editorial.images[0]?.url ?? null} disabled={archived}/>
    </Card>

    <div>
      <h3 className="text-lg font-semibold">Blocos da página</h3>
      <p className="mt-1 text-sm text-[#746c67]">Ordene, oculte e edite os blocos. Preço, ficha e fotos vêm sempre do Vista.</p>
      <div className="mt-4"><BlocksEditor id={page.id} version={page.version} initial={page.content.blocks} disabled={archived}/></div>
    </div>
  </div>;
}
