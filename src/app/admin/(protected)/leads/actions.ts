"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/features/access/server";
import { AuthenticationRequiredError, ForbiddenError } from "@/features/access/errors";
import { createLeadServices } from "@/features/leads/factory";
export type LeadRetryState={ok?:string;error?:string};
export async function retryLeadAction(_state:LeadRetryState,form:FormData):Promise<LeadRetryState>{
  try{
    await requirePermission("leads:manage");const id=z.string().uuid().parse(form.get("id"));const {store,provider}=createLeadServices();const data=await store.get(id);
    if(!data)return {error:"Lead não encontrado."};
    if(data.lead.deliveryStatus!=="FAILED")return {error:"Somente entregas com falha confirmada podem ser reenviadas. Resultados indeterminados exigem reconciliação manual."};
    const lead=data.lead;const started=Date.now();
    if(lead.vistaVehicle.startsWith("LEGACY-"))return {error:"Este lead foi criado antes do campo obrigatório de imóvel. Faça uma nova submissão pelo formulário atualizado."};
    const result=await provider.sendLead({id:lead.id,type:lead.type,name:lead.name,email:lead.email??undefined,phone:lead.phone??undefined,message:lead.message??"",sourcePage:lead.sourcePage,propertyId:lead.propertyId,propertyVistaCode:lead.propertyVistaCode,vistaVehicle:lead.vistaVehicle});
    await store.recordDelivery(id,result,Date.now()-started,new Date());revalidatePath("/admin/leads");revalidatePath(`/admin/leads/${id}`);
    return result.status==="DELIVERED"||result.status==="MOCKED"?{ok:"Nova tentativa concluída."}:{error:"A nova tentativa não confirmou a entrega. Consulte o histórico."};
  }catch(error){if(error instanceof ForbiddenError||error instanceof AuthenticationRequiredError)return {error:error.message};return {error:"Não foi possível executar a nova tentativa."}}
}
