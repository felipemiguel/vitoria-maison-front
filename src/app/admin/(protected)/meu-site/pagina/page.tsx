import { redirect } from "next/navigation";
import { requirePagePermission } from "@/features/access/server";
import { getDatabase } from "@/database/client";
import { loadMySite } from "@/features/brokers/my-site";
import { findSiteViewById } from "@/features/brokers/public-site-service";
import { mediaPath } from "@/features/media/media-url";
import { EditSiteForm } from "@/components/admin/brokers/broker-forms";
import { PhotoUpload } from "@/components/admin/brokers/photo-upload";
import { BrokerHero } from "@/components/broker-site/broker-hero";
import { previewLinks } from "@/components/broker-site/links";

export const metadata = { title: "Página inicial do site" };

export default async function MySiteHomeEditor() {
  const user = await requirePagePermission("broker-site:update-own");
  const { site, profile } = await loadMySite(user);
  if (!site || !profile) redirect("/admin/meu-site");
  const editable = site.status === "DRAFT" || site.status === "PUBLISHED";
  const view = await findSiteViewById(getDatabase(), site.id);
  const settings = (site.settings ?? {}) as Record<string, unknown>;
  const card = "rounded-xl border border-[#ded5cd] bg-white p-5 sm:p-6";
  return <div className="space-y-6">
    {site.status === "PUBLISHED" && <p className="rounded-lg bg-[#f4ece6] px-4 py-3 text-sm text-[#5f5652]">Seu site está publicado: as alterações salvas aqui aparecem no site imediatamente.</p>}
    <section className={card}><h3 className="font-semibold">Textos da página</h3><div className="mt-5"><EditSiteForm editable={editable} site={{ version: site.version, status: site.status, subdomain: site.subdomain, headline: site.headline, subtitle: site.subtitle, introText: typeof settings.introText === "string" ? settings.introText : null, serviceText: typeof settings.serviceText === "string" ? settings.serviceText : null }}/></div></section>
    <section className={card}><h3 className="font-semibold">Imagem de apresentação</h3><div className="mt-4"><PhotoUpload variant="presentation" disabled={!editable} name={profile.displayName} currentUrl={site.heroImageAssetId ? mediaPath(site.heroImageAssetId) : site.heroImageUrl}/></div></section>
    {view && <section className="overflow-hidden rounded-xl border border-[#ded5cd]"><p className="border-b border-[#ded5cd] bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[.12em] text-[#817872]">Como o topo aparece no site</p><div className="pointer-events-none select-none" aria-hidden><BrokerHero site={view} links={previewLinks("/admin/meu-site/previa")}/></div></section>}
  </div>;
}
