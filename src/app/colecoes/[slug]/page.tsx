import { notFound, permanentRedirect } from "next/navigation";
import { PropertyCard } from "@/components/property/property-card";
import { JsonLd } from "@/components/seo/json-ld";
import { TrackEvent } from "@/components/analytics/track-event";
import { findCollectionRedirect, findPublicCollection } from "@/features/collections/public-collection-service";
import { getPropertiesByCollection } from "@/features/properties/services/property-service";
import { getSeoConfig } from "@/features/seo/config";
import { collectionDescription, collectionShareImages } from "@/features/collections/collection-seo";
import { buildPageMetadata } from "@/features/seo/metadata";
import { isCollectionIndexable } from "@/features/seo/indexing";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/features/seo/json-ld";

export const dynamic="force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({params}:Props){
  const {slug}=await params;const collection=await findPublicCollection(slug);
  if(!collection)return {title:"Coleção não encontrada",robots:{index:false,follow:false}};
  const items=await getPropertiesByCollection(slug);
  return buildPageMetadata({title:`Coleção ${collection.name}`,description:collectionDescription(collection,items.length),path:`/colecoes/${slug}`,index:isCollectionIndexable(items.length),images:collectionShareImages(collection,items)});
}

export default async function Page({params}:Props){const {slug}=await params;const collection=await findPublicCollection(slug);if(!collection){const current=await findCollectionRedirect(slug);if(current)permanentRedirect(`/colecoes/${current}`);notFound();}const items=await getPropertiesByCollection(slug);const seo=getSeoConfig();return <><JsonLd data={isCollectionIndexable(items.length)?[collectionPageJsonLd({name:collection.name,slug,description:collectionDescription(collection,items.length),propertySlugs:items.map(item=>item.slug)},seo),breadcrumbJsonLd([{name:"Início",path:"/"},{name:"Coleções",path:"/colecoes"},{name:collection.name,path:`/colecoes/${slug}`}],seo)]:null}/><TrackEvent name="view_collection" params={{collection:slug}}/><header className="bg-[#66142e] pb-20 pt-40 text-white"><div className="container"><p className="text-xs uppercase tracking-[.2em] text-white/60">Coleção Maison</p><h1 className="serif mt-4 text-6xl md:text-9xl">{collection.name}</h1>{collection.description&&<p className="mt-6 max-w-2xl text-white/70">{collection.description}</p>}</div></header><section className="section"><div className="container"><p className="mb-10 text-sm text-[#69635f]">{items.length} imóveis nesta coleção</p><div className="grid gap-8 md:grid-cols-3">{items.map((p,i)=><PropertyCard key={p.id} property={p} preload={i===0} sizes="(min-width: 768px) 33vw, 100vw"/>)}</div>{items.length===0&&<p className="py-16 text-center text-[#69635f]">Nenhum imóvel elegível nesta coleção no momento.</p>}</div></section></>}
