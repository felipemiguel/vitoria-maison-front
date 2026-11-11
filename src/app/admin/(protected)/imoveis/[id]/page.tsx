import { requirePagePermission } from "@/features/access/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PropertyDetails } from "@/components/admin/property-details";
import { getAuthorizedAdminPropertyService } from "@/features/admin/properties/admin-property-service-factory";
import { PropertyManagement } from "@/components/admin/property-management";

export default async function AdminPropertyDetailsPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  await requirePagePermission("properties:read");
  const [{id},query]=await Promise.all([params,searchParams]);const property=await (await getAuthorizedAdminPropertyService("properties:read")).getById(id);if(!property)notFound();return <div className="mx-auto max-w-[1400px] space-y-6"><Link href="/admin/imoveis" className="inline-flex items-center gap-2 text-sm font-medium text-[#66142e]"><ArrowLeft size={16}/> Voltar aos imóveis</Link>{query.importado&&<Notice text="Imóvel importado como rascunho. Nenhuma publicação foi realizada."/>}{query.duplicado&&<Notice text="Este imóvel já estava na curadoria."/>}<div><h2 className="text-2xl font-semibold">{property.title}</h2><p className="mt-1 text-sm text-[#746c67]">Vista {property.vistaCode}</p></div><PropertyDetails property={property}/><PropertyManagement property={property}/></div>;
}
function Notice({text}:{text:string}){return <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{text}</p>}
