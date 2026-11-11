import { requirePagePermission } from "@/features/access/server";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PropertyTable } from "@/components/admin/property-table";
import { getAuthorizedAdminPropertyService } from "@/features/admin/properties/admin-property-service-factory";
import type { AdminPropertyFilters } from "@/features/admin/properties/types";

export const metadata = { title: "Imóveis administrativos" };

export default async function AdminPropertiesPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  await requirePagePermission("properties:read");
  const query = await searchParams;
  const filters: AdminPropertyFilters = {
    search: query.busca?.slice(0,100), neighborhood: query.bairro?.slice(0,160),
    publication: option(query.publicacao,["PUBLISHED","DRAFT"]), availability: option(query.disponibilidade,["AVAILABLE","UNAVAILABLE","UNKNOWN","EXPIRED"]),
    syncStatus: option(query.sincronizacao,["NEVER","SUCCESS","FAILED"]), sort: option(query.ordem,["newest","code","title","last-sync"])??"newest",
    page: positive(query.pagina,1), pageSize: 15,
  };
  const data = await (await getAuthorizedAdminPropertyService("properties:read")).list(filters);
  return <div className="mx-auto max-w-[1500px] space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">Imóveis</h2><p className="mt-1 text-sm text-[#746c67]">{data.total} imóvel(is) selecionado(s)</p></div><Link href="/admin/imoveis/novo" className="flex items-center gap-2 rounded-lg bg-[#66142e] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17}/> Importar imóvel</Link></div>
    <form className="grid gap-3 rounded-xl border border-[#ded5cd] bg-white p-4 sm:grid-cols-2 xl:grid-cols-6"><label className="xl:col-span-2"><span className="text-xs text-[#746c67]">Código ou título</span><span className="relative mt-1 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a817b]"/><input name="busca" defaultValue={query.busca} className="h-10 w-full rounded-lg border border-[#d8ccc3] pl-9 pr-3 text-sm"/></span></label><Filter name="bairro" label="Bairro" value={query.bairro}/><Select name="publicacao" label="Publicação" value={query.publicacao} options={[["","Todas"],["PUBLISHED","Aprovados"],["DRAFT","Rascunhos"]]}/><Select name="disponibilidade" label="Disponibilidade" value={query.disponibilidade} options={[["","Todas"],["AVAILABLE","Disponível"],["UNKNOWN","Desconhecida"],["EXPIRED","Expirada"],["UNAVAILABLE","Indisponível"]]}/><Select name="sincronizacao" label="Sincronização" value={query.sincronizacao} options={[["","Todas"],["SUCCESS","Sucesso"],["FAILED","Erro"],["NEVER","Nunca"]]}/><div className="flex items-end gap-2 xl:col-start-6"><button className="h-10 flex-1 rounded-lg bg-[#302724] px-4 text-sm font-semibold text-white">Filtrar</button><Link href="/admin/imoveis" className="grid h-10 place-items-center rounded-lg border border-[#d8ccc3] px-3 text-sm">Limpar</Link></div></form>
    <PropertyTable items={data.items}/><Pagination page={data.page} pages={data.pages} query={query}/>
  </div>;
}

function Filter({name,label,value}:{name:string;label:string;value?:string}){return <label><span className="text-xs text-[#746c67]">{label}</span><input name={name} defaultValue={value} className="mt-1 h-10 w-full rounded-lg border border-[#d8ccc3] px-3 text-sm outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10"/></label>}
function Select({name,label,value,options}:{name:string;label:string;value?:string;options:string[][]}){return <label><span className="text-xs text-[#746c67]">{label}</span><select name={name} defaultValue={value} className="mt-1 h-10 w-full rounded-lg border border-[#d8ccc3] bg-white px-3 text-sm outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10">{options.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>}
function Pagination({page,pages,query}:{page:number;pages:number;query:Record<string,string|undefined>}){if(pages<=1)return null;const items=pageItems(page,pages);return <nav aria-label="Paginação dos imóveis" className="flex flex-wrap justify-center gap-2">{items.map((current,index)=>current===null?<span aria-hidden="true" key={`ellipsis-${index}`} className="grid size-10 place-items-center text-[#817872]">…</span>:(()=>{const params=new URLSearchParams(Object.entries(query).filter((entry):entry is [string,string]=>Boolean(entry[1])));params.set("pagina",String(current));const active=page===current;return <Link aria-current={active?"page":undefined} aria-label={`Página ${current}`} key={current} href={`/admin/imoveis?${params.toString()}`} className={`grid size-10 place-items-center rounded-lg border text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#66142e] ${active?"border-[#66142e] bg-[#66142e] text-white":"border-[#d8ccc3] bg-white hover:border-[#66142e]"}`}>{current}</Link>})())}</nav>}
function pageItems(page:number,pages:number):(number|null)[]{const visible=new Set([1,pages,page-1,page,page+1].filter((value)=>value>=1&&value<=pages));const sorted=[...visible].sort((a,b)=>a-b);const result:(number|null)[]=[];for(const value of sorted){const previous=result.at(-1);if(typeof previous==="number"&&value-previous>1)result.push(null);result.push(value)}return result}
function positive(value:string|undefined,fallback:number){const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:fallback}
function option<T extends string>(value:string|undefined,values:readonly T[]):T|undefined{return values.includes(value as T)?value as T:undefined}
