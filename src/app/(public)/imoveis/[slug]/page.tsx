import { notFound } from "next/navigation";
import { InterestForm } from "@/components/contact/interest-form";
import { PropertyDetail } from "@/components/property/property-detail";
import { getPublishedPropertyBySlug, propertyRepository } from "@/features/properties/services/property-service";
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
  return <><JsonLd data={[propertyListingJsonLd(property,seo),breadcrumbJsonLd([{name:"Início",path:"/"},{name:"Imóveis",path:"/imoveis"},{name:property.editorial.title,path:`/imoveis/${property.slug}`}],seo)]}/><TrackEvent name="view_item" params={{property_code:c.code,property_type:c.type,purpose:c.purpose,neighborhood:property.location.neighborhood}}/>
    <PropertyDetail property={property} backHref="/imoveis" related={related} aside={<InterestForm propertyId={property.id} code={c.code} sourcePage={`/imoveis/${slug}`}/>}/></>;
}
