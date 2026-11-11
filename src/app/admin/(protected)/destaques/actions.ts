"use server";
import { revalidatePath } from "next/cache";
import { getAuthorizedAdminServices } from "@/features/admin/properties/admin-property-service-factory";
import type { AdminActionState } from "../imoveis/[id]/actions";
export async function reorderHighlightsAction(_state:AdminActionState,form:FormData):Promise<AdminActionState>{try{const ids=form.getAll("id").map(String);const entries=ids.map(id=>({id,order:Number(form.get(`order:${id}`))}));const {admin,curation}=await getAuthorizedAdminServices("properties:edit");await curation.reorderFeatured(entries,admin.id);revalidatePath("/admin/destaques");return {ok:"Ordem dos destaques atualizada."}}catch(error){return {error:error instanceof Error?error.message:"Não foi possível reordenar."}}}
