import Link from "next/link";
import type { BrokerSiteView } from "@/features/brokers/public-site-service";
import { BrokerPortrait } from "./broker-portrait";
import type { BrokerLinks } from "./links";

/** Seção 05: sobre o corretor. Somente dados do perfil; CRECI apenas quando verificado pela equipe. */
export function BrokerAbout({ site, links }: { site: BrokerSiteView; links: BrokerLinks }) {
  return <section id="sobre" className="section scroll-mt-24 bg-white"><div className="container grid gap-12 md:grid-cols-[.8fr_1.2fr] md:gap-20">
    <div className="max-w-sm"><BrokerPortrait name={site.displayName} url={site.profileImageUrl} sizes="(min-width: 768px) 30vw, 100vw"/></div>
    <div className="self-center">
      <p className="eyebrow">Sobre mim</p>
      <h2 className="serif section-title mt-4">{site.displayName}</h2>
      {site.professionalTitle && <p className="mt-3 text-[#69635f]">{site.professionalTitle}</p>}
      {site.biography ? <div className="prose mt-8 max-w-2xl space-y-4">{site.biography.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        : <p className="prose mt-8 max-w-2xl">Corretor(a) parceiro(a) da Vitória Maison.</p>}
      <dl className="mt-10 grid gap-6 border-t border-[#e6ddd6] pt-8 text-sm sm:grid-cols-2">
        {site.creci && <div><dt className="text-[10px] uppercase tracking-[.16em] text-[#69635f]">CRECI</dt><dd className="mt-2">{site.creci}</dd></div>}
        {site.specialties?.length ? <div><dt className="text-[10px] uppercase tracking-[.16em] text-[#69635f]">Especialidades</dt><dd className="mt-2">{site.specialties.join(" · ")}</dd></div> : null}
        {site.serviceRegions?.length ? <div><dt className="text-[10px] uppercase tracking-[.16em] text-[#69635f]">Regiões</dt><dd className="mt-2">{site.serviceRegions.join(" · ")}</dd></div> : null}
      </dl>
      {links.contact && <Link href={links.contact} className="link-line mt-10">Vamos conversar</Link>}
    </div>
  </div></section>;
}
