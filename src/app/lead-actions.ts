"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createLeadServices } from "@/features/leads/factory";
import { LeadRateLimitError } from "@/features/leads/drizzle-lead-store";

export type LeadActionState={ok?:string;status?:string;error?:string;fields?:Record<string,string[]>};
const ownerContextSchema=z.object({location:z.string().trim().max(160).optional(),propertyType:z.string().trim().max(100).optional(),ownerIntent:z.enum(["","Venda","Locação","Avaliação"]).optional()});

export async function submitLeadAction(_state:LeadActionState,form:FormData):Promise<LeadActionState>{
  try{
    const type=String(form.get("type")??"");let message=String(form.get("message")??"").trim();let vehicle=String(form.get("vehicle")??"").trim();
    if(type==="OWNER_CONTACT"){
      const context=ownerContextSchema.parse({location:String(form.get("location")??"").trim()||undefined,propertyType:String(form.get("propertyType")??"").trim()||undefined,ownerIntent:String(form.get("ownerIntent")??"")});
      const details=[context.location&&`Localização aproximada: ${context.location}`,context.propertyType&&`Tipo de imóvel: ${context.propertyType}`,context.ownerIntent&&`Interesse: ${context.ownerIntent}`].filter(Boolean);
      message=[...details,message].filter(Boolean).join("\n");
      vehicle=context.propertyType??"";
    }
    const cookieStore=await cookies();let sessionId=cookieStore.get("vm_lead_session")?.value;
    if(!sessionId){sessionId=crypto.randomUUID();cookieStore.set("vm_lead_session",sessionId,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24});}
    const result=await createLeadServices().submission.submit({type,name:String(form.get("name")??""),email:String(form.get("email")??""),phone:String(form.get("phone")??""),message,vehicle,propertyId:String(form.get("propertyId")??"")||undefined,sourcePage:String(form.get("sourcePage")??""),submissionKey:String(form.get("submissionKey")??""),website:String(form.get("website")??"")},sessionId);
    return {ok:result.message,status:result.status};
  }catch(error){
    if(error instanceof z.ZodError)return {error:error.issues[0]?.message??"Revise os dados informados.",fields:z.flattenError(error).fieldErrors};
    if(error instanceof LeadRateLimitError)return {error:error.message};
    if(error instanceof Error&&/não está disponível|já foi recebida/i.test(error.message))return {error:error.message};
    console.error(JSON.stringify({level:"error",event:"lead.submission.failed",errorCode:"SUBMISSION_FAILED"}));
    return {error:"Não foi possível registrar sua solicitação agora. Tente novamente em instantes."};
  }
}
