import { notFound } from "next/navigation";
import Link from "next/link";
import { Gallery } from "@/components/property/gallery";
import { InterestForm } from "@/components/contact/interest-form";
import { PropertyCard } from "@/components/property/property-card";
import { getPublishedPropertyBySlug, propertyRepository } from "@/features/properties/services/property-service";
import { formatPrice } from "@/lib/format";
import { JsonLd } from "@/components/seo/json-ld";
import { TrackEvent } from "@/components/analytics/track-event";
import { getSeoConfig } from "@/features/seo/config";
import { buildPageMetadata } from "@/features/seo/metadata";
import { breadcrumbJsonLd, propertyListingJsonLd } from "@/features/seo/json-ld";
import { propertySeoDescription, propertySeoTitle } from "@/features/seo/property-seo";

/**
 * Renderização dinâmica: a elegibilidade depende do horário (expiração da confirmação manual
 * e idade do snapshot) e de sincronizações executadas fora do Next.js. Um cache de página
 * poderia manter visível um imóvel que deixou de ser elegível.
 */
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({params}:Props){
  const property=await getPublishedPropertyBySlug((await params).slug);
  if(!property)return {title:"Imóvel não encontrado",robots:{index:false,follow:false}};
  return buildPageMetadata({title:propertySeoTitle(property),description:propertySeoDescription(property),path:`/imoveis/${property.slug}`,images:property.editorial.images.slice(0,3).map((image)=>({url:image.url,alt:image.alt}))});
}

export default async function Detail({params}:Props){
  const slug=(await params).slug;const property=await getPublishedPropertyBySlug(slug);if(!property)notFound();const c=property.commercial;
  const related=(await propertyRepository.list({neighborhood:property.location.neighborhood,pageSize:4})).items.filter((item)=>item.id!==property.id).slice(0,3);
  const seo=getSeoConfig();
  return <><JsonLd data={[propertyListingJsonLd(property,seo),breadcrumbJsonLd([{name:"Início",path:"/"},{name:"Imóveis",path:"/imoveis"},{name:property.editorial.title,path:`/imoveis/${property.slug}`}],seo)]}/><TrackEvent name="view_item" params={{property_code:c.code,property_type:c.type,purpose:c.purpose,neighborhood:property.location.neighborhood}}/><header className="bg-[#66142e] pb-14 pt-36 text-white"><div className="container"><Link href="/imoveis" className="text-[10px] uppercase tracking-[.16em] text-white/65">← Voltar aos imóveis</Link><p className="mt-12 text-[11px] uppercase tracking-[.18em] text-white/65">{property.location.neighborhood} · {property.location.city}</p><h1 className="serif mt-4 max-w-5xl text-5xl leading-none md:text-8xl">{property.editorial.title}</h1></div></header><Gallery images={property.editorial.images}/><section className="section"><div className="container grid gap-14 lg:grid-cols-[1fr_380px]"><div><p className="eyebrow">Sobre o imóvel</p><p className="serif mt-5 text-4xl">{formatPrice(c.price)}</p><div className="mt-8 grid grid-cols-2 gap-px border border-[#e6ddd6] bg-[#e6ddd6] sm:grid-cols-4">{[["Área",`${c.area} m²`],["Dormitórios",c.bedrooms],["Suítes",c.suites],["Vagas",c.parkingSpaces]].filter(([,value])=>value).map(([label,value])=><div className="bg-[#f8f6f2] p-5" key={label as string}><span className="block text-[9px] uppercase tracking-[.14em] text-[#69635f]">{label}</span><b className="serif mt-2 block text-2xl font-normal">{value}</b></div>)}</div><h2 className="serif mt-12 text-4xl">Um olhar mais atento</h2><p className="prose mt-5 max-w-3xl">{property.editorial.description}</p><h2 className="serif mt-12 text-4xl">Diferenciais</h2><ul className="mt-6 grid gap-3 sm:grid-cols-2">{property.editorial.features.map((feature)=><li className="border-b border-[#e6ddd6] pb-3 text-sm" key={feature}>— {feature}</li>)}</ul><p className="mt-10 text-xs uppercase tracking-[.12em] text-[#69635f]">Código do imóvel: {c.code}</p></div><InterestForm propertyId={property.id} code={c.code} sourcePage={`/imoveis/${slug}`}/></div></section>{related.length>0&&<section className="section bg-[#f0eae4]"><div className="container"><h2 className="serif section-title">Você também pode gostar</h2><div className="mt-12 grid gap-7 md:grid-cols-3">{related.map((item)=><PropertyCard key={item.id} property={item} sizes="(min-width: 768px) 33vw, 100vw"/>)}</div></div></section>}</>;
}
