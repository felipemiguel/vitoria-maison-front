import Image from "next/image";
import Link from "next/link";
import type { AdminPropertySummary } from "@/features/admin/properties/types";
import { EmptyState } from "./empty-state";
import { LinkPending } from "./link-pending";
import { PropertyStatusBadge } from "./property-status-badge";
import { availabilityDisplay, availabilityLabel } from "@/features/admin/properties/availability-display";

export function PropertyTable({ items }: { items: AdminPropertySummary[] }) {
  if (!items.length) return <EmptyState title="Nenhum imóvel encontrado" description="Ajuste os filtros ou importe um imóvel do Vista."/>;
  return <>
    {/* Tabela a partir de 1024px: colunas agrupadas (sincronização só ≥1280px) para caber ao lado da barra lateral;
        rolagem horizontal de segurança e a ação "Visualizar" fixa à direita. */}
    <div className="hidden overflow-x-auto rounded-xl border border-[#ded5cd] bg-white lg:block"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[#f7f3ef] text-xs text-[#746c67]"><tr>
      <th className="px-4 py-3 font-medium">Imóvel</th><th className="px-4 py-3 font-medium">Preço</th><th className="px-4 py-3 font-medium">Status</th><th className="hidden px-4 py-3 font-medium xl:table-cell">Sincronização</th><th className="sticky right-0 bg-[#f7f3ef] px-4 py-3"><span className="sr-only">Ações</span></th>
    </tr></thead><tbody className="divide-y divide-[#eee7e1]">{items.map(property=>{const availability=availabilityDisplay(property);return <tr key={property.id} className="group hover:bg-[#fcfaf8]">
      <td className="px-4 py-3"><div className="flex items-center gap-3">{property.coverImageUrl?<Image src={property.coverImageUrl} alt="" width={64} height={48} className="h-12 w-16 shrink-0 rounded-md object-cover"/>:<div className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-[#eee7e1] text-[10px] text-[#8a817b]">Sem foto</div>}<div className="min-w-0"><p className="max-w-[18rem] truncate font-medium xl:max-w-[24rem]" title={property.title}>{property.title}</p><p className="mt-1 truncate text-xs text-[#817872]">Vista {property.vistaCode}{[property.neighborhood,property.city].filter(Boolean).length?` · ${[property.neighborhood,property.city].filter(Boolean).join(", ")}`:""}</p></div></div></td>
      <td className="whitespace-nowrap px-4 py-3">{priceLabel(property)}<p className="mt-1 text-xs text-[#817872]">{purposeLabel(property.publicationPurpose)}</p></td>
      <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5"><PropertyStatusBadge value={property.publiclyEligible?"PUBLIC":property.published?"PUBLISHED":"DRAFT"} label={property.publiclyEligible?"Visível":property.published?"Aprovado":"Rascunho"}/><PropertyStatusBadge value={availability} label={availabilityLabel(availability)}/></div></td>
      <td className="hidden whitespace-nowrap px-4 py-3 xl:table-cell"><PropertyStatusBadge value={property.lastSyncStatus}/><p className="mt-1 text-[11px] text-[#817872]">{dateLabel(property.lastSyncAttemptAt)}</p></td>
      <td className="sticky right-0 bg-white px-4 py-3 text-right group-hover:bg-[#fcfaf8]"><Link href={`/admin/imoveis/${property.id}`} className="inline-flex whitespace-nowrap rounded-lg border border-[#e4d7ce] px-3 py-1.5 text-sm font-semibold text-[#66142e] hover:bg-[#f7f2ee]"><LinkPending>Visualizar</LinkPending></Link></td>
    </tr>})}</tbody></table></div>
    <div className="grid gap-4 lg:hidden">{items.map(property=>{const availability=availabilityDisplay(property);return <article key={property.id} className="rounded-xl border border-[#ded5cd] bg-white p-4"><div className="flex gap-3">{property.coverImageUrl?<Image src={property.coverImageUrl} alt="" width={88} height={72} className="h-[72px] w-[88px] rounded-lg object-cover"/>:<div className="grid h-[72px] w-[88px] place-items-center rounded-lg bg-[#eee7e1] text-[10px]">Sem foto</div>}<div className="min-w-0"><p className="truncate font-semibold">{property.title}</p><p className="mt-1 text-xs text-[#746c67]">Vista {property.vistaCode} · {[property.neighborhood,property.city].filter(Boolean).join(", ")}</p><p className="mt-2 text-sm">{priceLabel(property)}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><PropertyStatusBadge value={property.publiclyEligible?"PUBLIC":property.published?"PUBLISHED":"DRAFT"} label={property.publiclyEligible?"Visível":property.published?"Aprovado":"Rascunho"}/><PropertyStatusBadge value={availability} label={availabilityLabel(availability)}/><PropertyStatusBadge value={property.lastSyncStatus}/></div><Link href={`/admin/imoveis/${property.id}`} className="mt-4 block border-t border-[#eee7e1] pt-3 text-sm font-semibold text-[#66142e]"><LinkPending>Visualizar detalhes →</LinkPending></Link></article>})}</div>
  </>;
}

function priceLabel(property: AdminPropertySummary): string { const value=property.publicationPurpose==="RENT"?property.rentalPrice:property.salePrice;return value?new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(Number(value)):"—"; }
function purposeLabel(value: AdminPropertySummary["publicationPurpose"]): string { return value?({SALE:"Venda",RENT:"Locação",INVESTMENT:"Investimento"}[value]):"Não definida"; }
function dateLabel(value: Date|null): string { return value?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(value):"Nunca"; }
