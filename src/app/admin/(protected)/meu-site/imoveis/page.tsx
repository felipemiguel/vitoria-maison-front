import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { loadMySite } from "@/features/brokers/my-site";
import { MAX_FEATURED_PROPERTIES, MAX_SELECTED_PROPERTIES } from "@/features/brokers/broker-site-service";
import { propertyRepository } from "@/features/properties/services/property-service";
import type { PropertyFilters, PropertyPurpose, PropertyType } from "@/features/properties/types";
import { PROPERTY_TYPE_LABEL } from "@/features/seo/property-seo";
import { formatPrice } from "@/lib/format";
import { AddPropertiesForm, SelectionRow } from "@/components/admin/brokers/broker-forms";
import { SafeImage } from "@/components/property/safe-image";
import { EmptyState } from "@/components/admin/empty-state";

export const metadata = { title: "Imóveis do meu site" };
type Search = Record<string, string | undefined>;
const PURPOSES: Record<PropertyPurpose, string> = { SALE: "Venda", RENT: "Locação", INVESTMENT: "Investimento" };
const PAGE_SIZE = 12;
const int = (value: string | undefined, min: number, max: number) => { const n = Number(value); return Number.isInteger(n) && n >= min && n <= max ? n : undefined; };

/** Filtros validados no servidor; a consulta só retorna imóveis PUBLICADOS e ELEGÍVEIS na Maison. */
function filtersFrom(query: Search): PropertyFilters {
  return {
    vistaCode: query.codigo?.trim().slice(0, 40) || undefined,
    neighborhood: query.bairro?.trim().slice(0, 80) || undefined,
    city: query.cidade?.trim().slice(0, 80) || undefined,
    type: (Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[]).find((type) => type === query.tipo),
    purpose: (Object.keys(PURPOSES) as PropertyPurpose[]).find((purpose) => purpose === query.finalidade),
    minPrice: int(query.valorMin, 1, 1_000_000_000), maxPrice: int(query.valorMax, 1, 1_000_000_000),
    bedrooms: int(query.dormitorios, 1, 20),
    sort: (["price-asc", "price-desc", "area-desc"] as const).find((sort) => sort === query.ordem),
    page: int(query.pagina, 1, 10_000) ?? 1, pageSize: PAGE_SIZE,
  };
}

export default async function MySitePropertiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePagePermission("broker-site:update-own");
  const { site, selection } = await loadMySite(user);
  if (!site) redirect("/admin/meu-site");
  const query = await searchParams;
  const filters = filtersFrom(query);
  const available = await propertyRepository.list(filters);
  const selected = new Set(selection.map((item) => item.curatedPropertyId));
  const featuredCount = selection.filter((item) => item.featured).length;
  const suspended = site.status === "SUSPENDED";
  const link = (page: number) => { const params = new URLSearchParams(Object.entries({ ...query, pagina: String(page) }).filter((entry): entry is [string, string] => Boolean(entry[1]))); return `/admin/meu-site/imoveis?${params}`; };
  const control = "w-full min-w-0 rounded-lg border border-[#d8ccc3] bg-white px-3 py-2 text-sm";
  const card = "rounded-xl border border-[#ded5cd] bg-white p-5 sm:p-6";
  return <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
    <section className="space-y-4">
      <div><h3 className="font-semibold">Imóveis disponíveis na Maison</h3><p className="mt-1 text-sm text-[#746c67]">Somente imóveis publicados e disponíveis. Preço, fotos e descrição vêm do cadastro da Maison e não são editáveis.</p></div>
      <form className={`${card} grid gap-3 sm:grid-cols-2 2xl:grid-cols-4`}>
        <input name="codigo" defaultValue={query.codigo} placeholder="Código" aria-label="Código do imóvel" className={control}/>
        <input name="bairro" defaultValue={query.bairro} placeholder="Bairro" aria-label="Bairro" className={control}/>
        <input name="cidade" defaultValue={query.cidade} placeholder="Cidade" aria-label="Cidade" className={control}/>
        <select name="tipo" defaultValue={query.tipo ?? ""} aria-label="Tipo" className={control}><option value="">Todos os tipos</option>{Object.entries(PROPERTY_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select name="finalidade" defaultValue={query.finalidade ?? ""} aria-label="Finalidade" className={control}><option value="">Todas as finalidades</option>{Object.entries(PURPOSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><input name="valorMin" type="number" min={1} defaultValue={query.valorMin} placeholder="Valor mín." aria-label="Valor mínimo" className={control}/><input name="valorMax" type="number" min={1} defaultValue={query.valorMax} placeholder="Valor máx." aria-label="Valor máximo" className={control}/></div>
        <select name="dormitorios" defaultValue={query.dormitorios ?? ""} aria-label="Dormitórios" className={control}><option value="">Dormitórios</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}</select>
        <select name="ordem" defaultValue={query.ordem ?? ""} aria-label="Ordenar" className={control}><option value="">Ordem da curadoria</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="area-desc">Maior área</option></select>
        <div className="flex gap-2 sm:col-span-2 sm:justify-end 2xl:col-span-4"><Link href="/admin/meu-site/imoveis" className="rounded-lg border border-[#d8ccc3] px-4 py-2 text-sm">Limpar</Link><button className="rounded-lg bg-[#302724] px-5 py-2 text-sm font-semibold text-white">Filtrar</button></div>
      </form>
      <p className="text-sm text-[#746c67]">{available.total} imóvel(is) encontrado(s)</p>
      {available.items.length === 0 ? <EmptyState title="Nenhum imóvel disponível" description="Ajuste os filtros. Apenas imóveis publicados e disponíveis na Maison podem ser selecionados."/> :
      <AddPropertiesForm><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{available.items.map((property) => {
        const isSelected = selected.has(property.id);
        const c = property.commercial;
        return <article key={property.id} className={`overflow-hidden rounded-xl border bg-white ${isSelected ? "border-[#66142e]" : "border-[#ded5cd]"}`}>
          <div className="relative aspect-[4/3] bg-[#e9e4df]">{property.editorial.images[0] && <SafeImage src={property.editorial.images[0].url} alt={property.editorial.images[0].alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover"/>}
            {!isSelected && !suspended && <label className="absolute left-3 top-3 grid size-9 cursor-pointer place-items-center rounded-full bg-white shadow"><input type="checkbox" name="ids" value={property.id} className="size-4 accent-[#66142e]"/><span className="sr-only">Selecionar {property.editorial.title}</span></label>}
            {isSelected && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#66142e] px-2.5 py-1 text-xs font-semibold text-white"><Check size={13}/> Na seleção</span>}</div>
          <div className="space-y-1 p-4 text-sm"><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#9b6a2f]">Código {c.code} · {PROPERTY_TYPE_LABEL[c.type]}</p><p className="truncate font-medium">{property.editorial.title}</p><p className="text-xs text-[#746c67]">{property.location.neighborhood}, {property.location.city}</p>
            <p className="text-xs text-[#5f5652]">{formatPrice(c.price)} · {c.area} m²{c.bedrooms ? ` · ${c.bedrooms} dorm.` : ""} · {PURPOSES[c.purpose]}</p><p className="text-xs text-emerald-700">Disponível na Maison</p>
            {!isSelected && !suspended && <button name="single" value={property.id} className="mt-2 w-full rounded-lg border border-[#66142e] px-3 py-2 text-sm font-semibold text-[#66142e] hover:bg-[#f7f2ee]">Adicionar ao site</button>}</div>
        </article>;
      })}</div></AddPropertiesForm>}
      {available.pages > 1 && <nav aria-label="Paginação" className="flex items-center justify-center gap-3 text-sm">{available.page > 1 && <Link href={link(available.page - 1)} className="rounded-lg border border-[#d8ccc3] bg-white px-3 py-2">Anterior</Link>}<span>Página {available.page} de {available.pages}</span>{available.page < available.pages && <Link href={link(available.page + 1)} className="rounded-lg border border-[#d8ccc3] bg-white px-3 py-2">Próxima</Link>}</nav>}
    </section>
    <aside className="order-first space-y-3 xl:order-none xl:sticky xl:top-6 xl:self-start">
      <div className={card}><h3 className="font-semibold">Minha seleção</h3><p className="mt-1 text-sm text-[#746c67]">{selection.length} de {MAX_SELECTED_PROPERTIES} imóveis · {featuredCount} de {MAX_FEATURED_PROPERTIES} destaques. Destaques aparecem primeiro na home; use as setas para ordenar.</p></div>
      {selection.length === 0 ? <p className="rounded-xl border border-dashed border-[#d8ccc3] bg-white p-6 text-center text-sm text-[#746c67]">Adicione imóveis da lista para montar seu site.</p> :
      <ol className="space-y-2">{selection.map((item) => {
        const group = selection.filter((other) => other.featured === item.featured);
        const position = group.indexOf(item);
        return <SelectionRow key={item.curatedPropertyId} propertyId={item.curatedPropertyId} title={item.title} subtitle={`${item.vistaCode} · ${[item.neighborhood, item.city].filter(Boolean).join(", ")}`} coverUrl={item.coverUrl} featured={item.featured} eligible={item.eligible} canUp={!suspended && position > 0} canDown={!suspended && position < group.length - 1} canFeature={!suspended && featuredCount < MAX_FEATURED_PROPERTIES}/>;
      })}</ol>}
    </aside>
  </div>;
}
