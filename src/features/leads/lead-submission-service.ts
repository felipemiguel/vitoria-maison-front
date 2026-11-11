import { createHmac } from "node:crypto";
import type { LeadProvider, LeadSubmissionResult } from "./types";
import { leadInputSchema } from "./validation";
import { DrizzleLeadStore, DuplicateLeadError } from "./drizzle-lead-store";

export class LeadSubmissionService {
  constructor(private readonly store:DrizzleLeadStore,private readonly provider:LeadProvider,private readonly secret:string,private readonly now:()=>Date=()=>new Date()){}
  async submit(raw:unknown,sessionId:string):Promise<LeadSubmissionResult>{
    const input=leadInputSchema.parse(raw);const now=this.now();
    const property=input.type==="PROPERTY_INTEREST"?await this.store.resolvePublishedProperty(input.propertyId!,now):null;
    if(input.type==="PROPERTY_INTEREST"&&!property)throw new Error("Este imóvel não está disponível para receber contatos.");
    const vistaVehicle=property?.vistaCode??input.vehicle!;
    const sessionHash=this.hash(`session:${sessionId}`);const deduplicationHash=this.hash([input.type,property?.id??"",vistaVehicle.toLowerCase(),input.email?.toLowerCase()??"",input.phone?.replace(/\D/g,"")??"",input.message.toLowerCase()].join("|"));
    let created;
    try{created=await this.store.create({type:input.type,propertyId:property?.id??null,propertyVistaCode:property?.vistaCode??null,vistaVehicle,name:input.name,email:input.email,phone:input.phone,message:input.message,sourcePage:input.sourcePage,submissionKey:input.submissionKey,deduplicationHash,sessionHash},now)}catch(error){if(error instanceof DuplicateLeadError)return {id:error.existingId,status:error.status,message:"Já recebemos esta solicitação recentemente."};throw error}
    if(!created.created)return {id:created.id,status:created.status,message:messageFor(created.status)};
    console.info(JSON.stringify({level:"info",event:"lead.received",leadId:created.id,type:input.type}));
    const started=Date.now();const lead={id:created.id,type:input.type,name:input.name,email:input.email,phone:input.phone,message:input.message,sourcePage:input.sourcePage,propertyId:property?.id??null,propertyVistaCode:property?.vistaCode??null,vistaVehicle};
    let result;
    try{result=await this.provider.sendLead(lead)}catch{result={status:"FAILED" as const,errorCode:"PROVIDER_ERROR"}}
    await this.store.recordDelivery(created.id,result,Date.now()-started,now);
    console.info(JSON.stringify({level:"info",event:"lead.delivery.completed",leadId:created.id,status:result.status,errorCode:result.errorCode}));
    return {id:created.id,status:result.status,message:messageFor(result.status)};
  }
  private hash(value:string){return createHmac("sha256",this.secret).update(value).digest("hex")}
}

function messageFor(status:string):string{if(status==="DELIVERED")return "Recebemos seu interesse. Nossa equipe entrará em contato.";if(status==="MOCKED")return "Sua solicitação foi registrada com segurança no ambiente de testes.";if(status==="UNKNOWN")return "Sua solicitação foi registrada e está aguardando confirmação de entrega.";if(status==="FAILED")return "Sua solicitação foi registrada, mas a entrega está pendente. Nossa equipe poderá processá-la novamente.";return "Sua solicitação já foi registrada."}
