import { requirePagePermission } from "@/features/access/server";
import { EmptyState } from "@/components/admin/empty-state";
import { HighlightsForm } from "@/components/admin/highlights-form";
import { getAuthorizedAdminPropertyService } from "@/features/admin/properties/admin-property-service-factory";
export default async function AdminHighlightsPage(){await requirePagePermission("properties:edit");const data=await (await getAuthorizedAdminPropertyService("properties:edit")).list({page:1,pageSize:50,featured:true,sort:"featured"});return <div className="mx-auto max-w-4xl"><h2 className="text-2xl font-semibold">Destaques da home</h2><p className="mt-1 text-sm text-[#746c67]">Somente imóveis elegíveis são exibidos publicamente, mesmo quando marcados.</p><div className="mt-6">{data.items.length?<HighlightsForm items={data.items}/>:<EmptyState title="Nenhum destaque" description="Marque um imóvel elegível como destaque na página de detalhes."/>}</div></div>}
