import Link from "next/link";
import { Suspense } from "react";
import { PropertyCard } from "@/components/property/property-card";
import { CatalogFilters } from "@/components/property/catalog-filters";
import { listCatalog, type CatalogRoute } from "@/features/properties/services/catalog-service";
import type { RawSearchParams } from "@/features/seo/indexing";
import { isTrackingParam } from "@/features/seo/indexing";

type Props = { route: CatalogRoute; params: RawSearchParams; eyebrow: string; heading: string; intro: string };

export async function CatalogView({ route, params, eyebrow, heading, intro }: Props) {
  const data = await listCatalog(route, params);
  const linkParams = Object.entries(params).flatMap(([key, value]) => {
    const item = Array.isArray(value) ? value[0] : value;
    return item && !isTrackingParam(key) ? [[key, item] as [string, string]] : [];
  });
  return <><header className="bg-[#66142e] pb-20 pt-40 text-white"><div className="container"><p className="text-[11px] uppercase tracking-[.2em] text-white/65">{eyebrow}</p><h1 className="serif mt-4 text-6xl font-normal md:text-8xl">{heading}</h1><p className="mt-5 max-w-xl leading-7 text-white/70">{intro}</p></div></header><section className="section !pt-10"><div className="container"><Suspense><CatalogFilters basePath={route.basePath} fixedPurpose={route.fixedPurpose}/></Suspense><div className="my-10 flex items-center justify-between"><p className="text-sm text-[#69635f]">{data.total} imóveis encontrados</p><Link href={route.basePath} className="text-xs uppercase tracking-[.13em] text-[#66142e]">Limpar filtros</Link></div>{data.items.length?<div className="grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((p,i)=><PropertyCard property={p} key={p.id} preload={i===0} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"/>)}</div>:<div className="border border-[#e6ddd6] bg-white px-6 py-24 text-center"><h2 className="serif text-4xl">Nenhum imóvel encontrado</h2><p className="mt-4 text-[#69635f]">Tente remover um ou mais filtros para ampliar sua busca.</p></div>}<nav className="mt-14 flex justify-center gap-2" aria-label="Paginação">{Array.from({length:data.pages},(_,i)=>{const p=new URLSearchParams(linkParams);if(i===0)p.delete("pagina");else p.set("pagina",String(i+1));const qs=p.toString();return <Link key={i} href={qs?`${route.basePath}?${qs}`:route.basePath} aria-current={data.page===i+1?"page":undefined} className={`grid size-11 place-items-center border ${data.page===i+1?"border-[#66142e] bg-[#66142e] text-white":"border-[#d8cdc4]"}`}>{i+1}</Link>})}</nav></div></section></>;
}
