import Link from "next/link";
import { PropertyCard } from "@/components/property/property-card";
import type { PaginatedProperties, PropertyFacets } from "@/features/properties/types";
import { BrokerSearch } from "./broker-search";
import type { BrokerLinks } from "./links";

type Props = { name?: string; data: PaginatedProperties; facets: PropertyFacets; values: Record<string, string | undefined>; links: BrokerLinks };

/** Catálogo exclusivo do corretor: mesma linguagem do catálogo institucional, escopo restrito ao site. */
export function BrokerCatalog({ data, facets, values, links }: Props) {
  const filtered = Boolean(values.finalidade || values.bairro || values.tipo);
  const query = (page: number) => {
    const params = new URLSearchParams(Object.entries({ finalidade: values.finalidade, bairro: values.bairro, tipo: values.tipo, ordem: values.ordem }).filter((entry): entry is [string, string] => Boolean(entry[1])));
    if (page > 1) params.set("pagina", String(page));
    return params.toString();
  };
  return <>
    <header className="bg-[#66142e] pb-16 pt-16 text-white md:pb-20 md:pt-24"><div className="container"><p className="text-[11px] uppercase tracking-[.2em] text-white/65">Minha seleção</p><h1 className="serif mt-4 text-5xl font-normal md:text-8xl">Imóveis</h1><p className="mt-5 max-w-xl leading-7 text-white/70">Imóveis que escolhi pessoalmente na curadoria Vitória Maison.</p></div></header>
    <section className="section !pt-10"><div className="container">
      <BrokerSearch facets={facets} action={links.catalog} values={values} withSort/>
      <div className="my-10 flex items-center justify-between gap-4"><p className="text-sm text-[#69635f]">{data.total} {data.total === 1 ? "imóvel encontrado" : "imóveis encontrados"}</p>{filtered && links.catalog && <Link href={links.catalog} className="text-xs uppercase tracking-[.13em] text-[#66142e]">Limpar filtros</Link>}</div>
      {data.items.length ? <div className="grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((property, index) => <PropertyCard key={property.id} property={property} href={links.property(property.slug)} preload={index === 0} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"/>)}</div>
        : <div className="border border-[#e6ddd6] bg-white px-6 py-20 text-center"><h2 className="serif text-4xl">{filtered ? "Nenhum imóvel com estes filtros" : "Estou preparando a minha seleção"}</h2><p className="mx-auto mt-4 max-w-md text-[#69635f]">{filtered ? "Remova um ou mais filtros para ver os demais imóveis desta seleção." : "Ainda não publiquei imóveis aqui."}</p></div>}
      {data.pages > 1 && <nav className="mt-14 flex flex-wrap justify-center gap-2" aria-label="Paginação">{Array.from({ length: data.pages }, (_, index) => { const href = links.catalogQuery(query(index + 1)); const current = data.page === index + 1; const className = `grid size-11 place-items-center border ${current ? "border-[#66142e] bg-[#66142e] text-white" : "border-[#d8cdc4]"}`; return href ? <Link key={index} href={href} aria-current={current ? "page" : undefined} className={className}>{index + 1}</Link> : <span key={index} className={className}>{index + 1}</span>; })}</nav>}
    </div></section>
  </>;
}
