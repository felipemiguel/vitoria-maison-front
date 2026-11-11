import Link from "next/link";
import { Gallery } from "@/components/property/gallery";
import { PropertyCard } from "@/components/property/property-card";
import type { Property } from "@/features/properties/types";
import { formatPrice } from "@/lib/format";

type Props = {
  property: Property;
  backHref: string;
  backLabel?: string;
  /** Coluna lateral de contato (formulário institucional ou contato do corretor). */
  aside: React.ReactNode;
  related: Property[];
  relatedTitle?: string;
  /** Prévia sem navegação: cards relacionados ficam sem link. */
  hrefFor?: (slug: string) => string | null;
};

/**
 * Corpo da página de detalhe de imóvel, compartilhado entre o site institucional e os sites de
 * corretores. Dados comerciais vêm sempre do snapshot publicado; nada é duplicado por site.
 */
export function PropertyDetail({ property, backHref, backLabel = "← Voltar aos imóveis", aside, related, relatedTitle = "Você também pode gostar", hrefFor }: Props) {
  const c = property.commercial;
  const facts = [["Área", `${c.area} m²`], ["Dormitórios", c.bedrooms], ["Suítes", c.suites], ["Vagas", c.parkingSpaces]].filter(([, value]) => value);
  return <>
    <header className="bg-[#66142e] pb-14 pt-36 text-white"><div className="container"><Link href={backHref} className="text-[10px] uppercase tracking-[.16em] text-white/65">{backLabel}</Link><p className="mt-12 text-[11px] uppercase tracking-[.18em] text-white/65">{property.location.neighborhood} · {property.location.city}</p><h1 className="serif mt-4 max-w-5xl text-5xl leading-none md:text-8xl">{property.editorial.title}</h1></div></header>
    <Gallery images={property.editorial.images}/>
    <section className="section"><div className="container grid gap-14 lg:grid-cols-[1fr_380px]"><div>
      <p className="eyebrow">Sobre o imóvel</p><p className="serif mt-5 text-4xl">{formatPrice(c.price)}</p>
      <div className="mt-8 grid grid-cols-2 gap-px border border-[#e6ddd6] bg-[#e6ddd6] sm:grid-cols-4">{facts.map(([label, value]) => <div className="bg-[#f8f6f2] p-5" key={label as string}><span className="block text-[9px] uppercase tracking-[.14em] text-[#69635f]">{label}</span><b className="serif mt-2 block text-2xl font-normal">{value}</b></div>)}</div>
      <h2 className="serif mt-12 text-4xl">Um olhar mais atento</h2><p className="prose mt-5 max-w-3xl">{property.editorial.description}</p>
      {property.editorial.features.length > 0 && <><h2 className="serif mt-12 text-4xl">Diferenciais</h2><ul className="mt-6 grid gap-3 sm:grid-cols-2">{property.editorial.features.map((feature) => <li className="border-b border-[#e6ddd6] pb-3 text-sm" key={feature}>— {feature}</li>)}</ul></>}
      <p className="mt-10 text-xs uppercase tracking-[.12em] text-[#69635f]">Código do imóvel: {c.code}</p>
    </div>{aside}</div></section>
    {related.length > 0 && <section className="section bg-[#f0eae4]"><div className="container"><h2 className="serif section-title">{relatedTitle}</h2><div className="mt-12 grid gap-7 md:grid-cols-3">{related.map((item) => <PropertyCard key={item.id} property={item} href={hrefFor ? hrefFor(item.slug) : undefined} sizes="(min-width: 768px) 33vw, 100vw"/>)}</div></div></section>}
  </>;
}
