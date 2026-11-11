import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PropertyCard } from "@/components/property/property-card";
import type { Property } from "@/features/properties/types";
import type { BrokerLinks } from "./links";

/** Seção 02: seleção do corretor (destaques e ordem dele). Estado vazio editorial, sem anúncios inventados. */
export function BrokerPropertySection({ properties, total, links, introText }: { name?: string; properties: Property[]; total: number; links: BrokerLinks; introText?: string | null }) {
  return <section className="section bg-white"><div className="container">
    <div className="mb-12 grid gap-6 md:grid-cols-2 md:items-end"><div><p className="eyebrow">Curadoria pessoal</p><h2 className="serif section-title mt-4">Minha seleção de imóveis</h2></div>
      {(introText || properties.length > 0) && <p className="prose max-w-lg whitespace-pre-line md:justify-self-end">{introText ?? "Imóveis que escolhi pessoalmente na curadoria Vitória Maison."}</p>}</div>
    {properties.length ? <>
      <div className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{properties.map((property) => <PropertyCard key={property.id} property={property} href={links.property(property.slug)} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"/>)}</div>
      {total > properties.length && links.catalog && <div className="mt-12 text-center"><Link href={links.catalog} className="link-line">Ver todos os {total} imóveis <ArrowRight size={15}/></Link></div>}
    </> : <div className="border border-[#e6ddd6] bg-[#f8f6f2] px-6 py-16 text-center md:py-20"><p className="serif text-3xl">Estou preparando a minha seleção.</p><p className="mx-auto mt-4 max-w-md text-[#69635f]">Ainda não publiquei imóveis aqui. Me conte o que você procura e receba sugestões da curadoria Vitória Maison.</p>{links.contact && <Link href={links.contact} className="btn btn-outline mt-8">Fale comigo</Link>}</div>}
  </div></section>;
}
