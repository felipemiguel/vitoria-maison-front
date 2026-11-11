import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BrokerSiteView } from "@/features/brokers/public-site-service";
import { BrokerPortrait } from "./broker-portrait";
import type { BrokerLinks } from "./links";

/** Seção 01: hero editorial dividido (empilhado no mobile). Apenas dados configurados. */
export function BrokerHero({ site, links }: { site: BrokerSiteView; links: BrokerLinks }) {
  const eyebrow = site.specialties?.[0] ?? site.professionalTitle ?? "Corretor(a) parceiro(a) Vitória Maison";
  return <section className="bg-[#f8f6f2]"><div className="container grid items-center gap-12 py-14 md:grid-cols-[1.1fr_.9fr] md:gap-16 md:py-20 lg:py-24">
    <div className="order-2 md:order-1">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="serif mt-6 text-[clamp(40px,6vw,84px)] font-normal leading-[.95] tracking-[-.03em] text-balance">{site.headline?.trim() || site.displayName}</h1>
      {site.subtitle && <p className="mt-6 max-w-xl text-base leading-7 text-[#69635f] md:text-lg">{site.subtitle}</p>}
      <p className="mt-8 text-sm text-[#181817]"><span className="text-[#69635f]">Olá, eu sou </span>{site.displayName}{site.professionalTitle && <span className="text-[#69635f]"> · {site.professionalTitle}</span>}</p>
      <div className="mt-10 flex flex-wrap gap-3">
        {links.catalog ? <Link href={links.catalog} className="btn">Explorar imóveis <ArrowRight size={16}/></Link> : <span className="btn">Explorar imóveis</span>}
        {links.contact && <Link href={links.contact} className="btn btn-outline">Fale comigo</Link>}
      </div>
    </div>
    <div className="order-1 md:order-2"><BrokerPortrait name={site.displayName} url={site.presentationImageUrl ?? site.profileImageUrl} alt={site.presentationImageUrl ? `Imagem de apresentação de ${site.displayName}` : undefined} sizes="(min-width: 768px) 42vw, 100vw" preload aspectClassName="aspect-[5/4] sm:aspect-[4/3] md:aspect-[4/5]"/></div>
  </div></section>;
}
