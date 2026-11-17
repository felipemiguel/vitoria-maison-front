import { cache } from "react";
import { notFound } from "next/navigation";
import { LandingPageViewer } from "@/components/landing/landing-page-viewer";
import { TrackEvent } from "@/components/analytics/track-event";
import { createLandingPageService } from "@/features/landing-pages/factory";
import { propertyRepository } from "@/features/properties/services/property-service";
import { buildPageMetadata } from "@/features/seo/metadata";

/**
 * Landing page pública (/lp/<slug>). Dinâmica, como o detalhe de imóvel: a elegibilidade do imóvel
 * depende do horário e das sincronizações do Vista. Sempre fora dos buscadores (noindex): é destino
 * de tráfego pago e divulgação; a página indexável do imóvel continua sendo /imoveis/<slug>.
 */
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

const load = cache(async (slug: string) => createLandingPageService().findPublished(slug));

export async function generateMetadata({ params }: Props) {
  const found = await load((await params).slug);
  if (!found) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  const { page, property } = found;
  const hero = page.content.blocks.find((block) => block.type === "hero");
  const title = page.seoTitle || (hero?.type === "hero" && hero.title) || property?.editorial.title || page.name;
  const description = page.seoDescription || (hero?.type === "hero" && hero.subtitle) || property?.editorial.description || "Imóvel com curadoria Vitória Maison.";
  const image = page.heroImageUrl ?? property?.editorial.images[0]?.url;
  return buildPageMetadata({ title, description, path: `/lp/${page.slug}`, index: false, images: image ? [{ url: image, alt: title }] : [] });
}

export default async function LandingPage({ params }: Props) {
  const found = await load((await params).slug);
  if (!found) notFound();
  const { page, property } = found;
  const alternatives = property ? [] : (await propertyRepository.list({ sort: "editorial", pageSize: 3 })).items;
  return <>
    {property && <TrackEvent name="view_item" params={{ property_code: property.commercial.code, property_type: property.commercial.type, purpose: property.commercial.purpose, neighborhood: property.location.neighborhood, source_page: `/lp/${page.slug}` }}/>}
    <LandingPageViewer page={page} property={property} alternatives={alternatives}/>
  </>;
}
