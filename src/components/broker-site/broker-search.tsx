import type { PropertyFacets } from "@/features/properties/types";
import { PROPERTY_TYPE_LABEL } from "@/features/seo/property-seo";

const PURPOSE_LABEL = { SALE: "Comprar", RENT: "Alugar", INVESTMENT: "Investir" } as const;
const SORT_OPTIONS = [["", "Minha ordem"], ["price-asc", "Menor preço"], ["price-desc", "Maior preço"], ["area-desc", "Maior área"]] as const;

type Values = { finalidade?: string; bairro?: string; tipo?: string; ordem?: string };

/**
 * Busca no catálogo EXCLUSIVO do corretor (formulário GET, funciona sem JavaScript).
 * Só oferece opções que existem entre os imóveis visíveis do site.
 */
export function BrokerSearch({ facets, action, values = {}, withSort = false, compact = false }: { facets: PropertyFacets; action: string | null; values?: Values; withSort?: boolean; compact?: boolean }) {
  const field = "flex min-h-20 flex-col justify-center border-b border-[#e6ddd6] px-5 md:border-b-0 md:border-r";
  const select = "w-full bg-transparent text-sm outline-none";
  const label = "mb-2 text-[9px] font-bold uppercase tracking-[.17em] text-[#69635f]";
  const fields: React.ReactNode[] = [];
  if (facets.purposes.length > 1) fields.push(<label key="p" className={field}><span className={label}>Finalidade</span><select name="finalidade" defaultValue={values.finalidade ?? ""} className={select}><option value="">Todas</option>{facets.purposes.map((purpose) => <option key={purpose} value={purpose}>{PURPOSE_LABEL[purpose]}</option>)}</select></label>);
  if (facets.neighborhoods.length > 1) fields.push(<label key="b" className={field}><span className={label}>Bairro</span><select name="bairro" defaultValue={values.bairro ?? ""} className={select}><option value="">Todos os bairros</option>{facets.neighborhoods.map((neighborhood) => <option key={neighborhood} value={neighborhood}>{neighborhood}</option>)}</select></label>);
  if (facets.types.length > 1) fields.push(<label key="t" className={field}><span className={label}>Categoria</span><select name="tipo" defaultValue={values.tipo ?? ""} className={select}><option value="">Todas</option>{facets.types.map((type) => <option key={type} value={type}>{PROPERTY_TYPE_LABEL[type]}</option>)}</select></label>);
  if (withSort) fields.push(<label key="o" className={field}><span className={label}>Ordenar</span><select name="ordem" defaultValue={values.ordem ?? ""} className={select}>{SORT_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>);
  if (!fields.length) return null;
  const columns = { 1: "md:grid-cols-[1fr_auto]", 2: "md:grid-cols-[1fr_1fr_auto]", 3: "md:grid-cols-[1fr_1fr_1fr_auto]", 4: "md:grid-cols-[1fr_1fr_1fr_1fr_auto]" }[fields.length as 1 | 2 | 3 | 4];
  return <form action={action ?? undefined} method="get" aria-label="Buscar na minha seleção" className={`grid border border-[#e6ddd6] bg-white ${compact ? "" : "p-3 md:p-2"} ${columns}`}>
    {fields}
    <button disabled={!action} className="btn m-3 md:m-0 md:min-w-44">Buscar</button>
  </form>;
}

export function BrokerFindSection({ facets, action }: { facets: PropertyFacets; action: string | null }) {
  const search = <BrokerSearch facets={facets} action={action}/>;
  if (!search || (facets.purposes.length < 2 && facets.neighborhoods.length < 2 && facets.types.length < 2)) return null;
  return <section className="bg-[#f0eae4] py-20 md:py-24"><div className="container"><p className="eyebrow">Encontrar imóvel</p><h2 className="serif section-title mt-4 max-w-2xl">Busque na minha seleção</h2><p className="prose mt-5 max-w-xl">A busca considera somente os imóveis que escolhi para este site.</p><div className="mt-10">{search}</div></div></section>;
}
