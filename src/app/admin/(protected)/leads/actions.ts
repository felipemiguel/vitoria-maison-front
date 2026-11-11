"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/features/access/server";
import { assertSameOriginAction } from "@/features/access/request";
import { AuthenticationRequiredError, ForbiddenError } from "@/features/access/errors";
import { createLeadServices } from "@/features/leads/factory";
import { LeadStateError } from "@/features/leads/drizzle-lead-store";
import { UserManagementError } from "@/features/users/errors";
import { assignmentAfterDelivery } from "@/features/leads/lead-submission-service";

export type LeadRetryState={ok?:string;error?:string};

function refresh(id:string){revalidatePath("/admin/leads");revalidatePath(`/admin/leads/${id}`);revalidatePath("/admin/meu-site","layout")}
function failure(error:unknown,fallback:string):LeadRetryState{
  if(error instanceof ForbiddenError||error instanceof AuthenticationRequiredError||error instanceof LeadStateError||error instanceof UserManagementError)return {error:error.message};
  if(error instanceof z.ZodError)return {error:error.issues[0]?.message??"Dados inválidos."};
  return {error:fallback};
}

/**
 * Nova tentativa somente para FAILED (falha confirmada). A reserva FAILED → PENDING é atômica:
 * cliques repetidos ou duas abas não geram dois envios ao Vista.
 */
export async function retryLeadAction(_state:LeadRetryState,form:FormData):Promise<LeadRetryState>{
  try{
    await assertSameOriginAction();await requirePermission("leads:manage");const id=z.string().uuid().parse(form.get("id"));const {store,provider,config}=createLeadServices();const data=await store.get(id);
    if(!data)return {error:"Lead não encontrado."};
    if(data.lead.deliveryStatus!=="FAILED")return {error:"Somente entregas com falha confirmada podem ser reenviadas. Resultados indeterminados exigem reconciliação manual."};
    if(data.lead.vistaVehicle.startsWith("LEGACY-"))return {error:"Este lead foi criado antes do campo obrigatório de imóvel. Faça uma nova submissão pelo formulário atualizado."};
    const lead=await store.claimForRetry(id,new Date());
    if(!lead)return {error:"Este lead já está sendo processado por outra tentativa."};
    const started=Date.now();
    let result;
    try{result=await provider.sendLead({id:lead.id,type:lead.type,name:lead.name,email:lead.email??undefined,phone:lead.phone??undefined,message:lead.message??"",sourcePage:lead.sourcePage,propertyId:lead.propertyId,propertyVistaCode:lead.propertyVistaCode,vistaVehicle:lead.vistaVehicle,vistaBrokerCode:lead.vistaBrokerCodeRequested})}
    catch{result={status:"FAILED" as const,errorCode:"PROVIDER_ERROR"}}
    const assignment=assignmentAfterDelivery({origin:lead.source,result,expectedCode:lead.vistaBrokerCodeRequested,verification:config.brokerAssignmentEnabled});
    await store.recordDelivery(id,result,Date.now()-started,new Date(),assignment);refresh(id);
    return result.status==="DELIVERED"||result.status==="MOCKED"?{ok:"Nova tentativa concluída."}:{error:"A nova tentativa não confirmou a entrega. Consulte o histórico."};
  }catch(error){return failure(error,"Não foi possível executar a nova tentativa.")}
}

const reconcileSchema=z.object({id:z.string().uuid(),outcome:z.enum(["DELIVERED","FAILED"]),vistaReference:z.string().trim().max(200).regex(/^[\w.-]*$/,"Código Vista inválido.").transform((value)=>value||null)});

/** Após conferir no Vista: o lead consta (DELIVERED) ou não consta (FAILED, liberando nova tentativa). */
export async function reconcileLeadAction(_state:LeadRetryState,form:FormData):Promise<LeadRetryState>{
  try{
    await assertSameOriginAction();const user=await requirePermission("leads:manage");
    const input=reconcileSchema.parse({id:form.get("id"),outcome:form.get("outcome"),vistaReference:String(form.get("vistaReference")??"")});
    await createLeadServices().store.reconcileDelivery(input.id,user.id,input.outcome,input.vistaReference,new Date());refresh(input.id);
    return {ok:input.outcome==="DELIVERED"?"Entrega confirmada manualmente.":"Marcado como não entregue. Agora é possível tentar novamente."};
  }catch(error){return failure(error,"Não foi possível reconciliar a entrega.")}
}

const assignmentSchema=z.object({id:z.string().uuid(),outcome:z.enum(["CONFIRMED","MISMATCH"]),observedCode:z.string().trim().max(40).regex(/^[\w.-]*$/,"Código inválido.").transform((value)=>value||null)});

/** Conferência comercial: o lead está (ou não) com o corretor esperado no Vista. Não altera nada no Vista. */
export async function checkLeadAssignmentAction(_state:LeadRetryState,form:FormData):Promise<LeadRetryState>{
  try{
    await assertSameOriginAction();const user=await requirePermission("leads:manage");
    const input=assignmentSchema.parse({id:form.get("id"),outcome:form.get("outcome"),observedCode:String(form.get("observedCode")??"")});
    await createLeadServices().store.checkAssignment(input.id,user.id,input.outcome,input.observedCode,new Date());refresh(input.id);
    return {ok:input.outcome==="CONFIRMED"?"Atribuição confirmada.":"Divergência registrada."};
  }catch(error){return failure(error,"Não foi possível registrar a conferência.")}
}
