import type { LeadDeliveryResult, LeadProvider, ResolvedLead } from "./types";
import type { LeadConfig } from "./config";

export class MockLeadProvider implements LeadProvider { async sendLead():Promise<LeadDeliveryResult>{return {status:"MOCKED"}} }

export class VistaLeadProvider implements LeadProvider {
  constructor(private readonly config:LeadConfig,private readonly fetchImpl:typeof fetch=fetch){}
  async sendLead(lead:ResolvedLead):Promise<LeadDeliveryResult>{
    if(!this.config.enabled||!this.config.baseUrl||!this.config.apiKey)throw new Error("Envio de leads ao Vista não habilitado.");
    const url=new URL(this.config.endpoint.replace(/^\//,""),this.config.baseUrl);url.searchParams.set("key",this.config.apiKey);
    const safeEndpoint=`${url.origin}${url.pathname}`;const startedAt=Date.now();
    console.info(JSON.stringify({level:"info",event:"vista.lead.request.started",method:"POST",endpoint:safeEndpoint}));
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),this.config.timeoutMs);
    const cadastro={lead:{nome:lead.name,...(lead.phone?{fone:lead.phone}:{}),...(lead.email?{email:lead.email}:{}),mensagem:lead.message,veiculo:lead.vistaVehicle,anuncio:lead.sourcePage}};
    const requestBody=new URLSearchParams();requestBody.set("cadastro",JSON.stringify(cadastro));
    try{
      const response=await this.fetchImpl(url,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:requestBody.toString(),redirect:"manual",signal:controller.signal});
      const responseText=(await response.text()).slice(0,10_000);const responseSummary=response.ok?undefined:safeErrorSummary(responseText);
      const responseLog={level:response.ok?"info":"error",event:"vista.lead.response.received",method:"POST",endpoint:safeEndpoint,status:response.status,durationMs:Date.now()-startedAt,...(responseSummary?{response:responseSummary}:{})};
      if(response.ok)console.info(JSON.stringify(responseLog));else console.error(JSON.stringify(responseLog));
      if(response.status>=300&&response.status<400)return {status:"FAILED",errorCode:"REDIRECT_BLOCKED"};
      if(!response.ok)return {status:response.status>=500?"UNKNOWN":"FAILED",errorCode:`HTTP_${response.status}`};
      let responseBody:unknown;
      try{responseBody=responseText?JSON.parse(responseText):undefined}catch{return {status:"UNKNOWN",errorCode:"INVALID_JSON"}}
      if(isBusinessError(responseBody))return {status:"FAILED",errorCode:"BUSINESS_ERROR"};
      return {status:"DELIVERED",reference:externalReference(responseBody)};
    }catch(error){const errorCode=error instanceof DOMException&&error.name==="AbortError"?"TIMEOUT":"NETWORK";console.error(JSON.stringify({level:"error",event:"vista.lead.request.failed",method:"POST",endpoint:safeEndpoint,errorCode,durationMs:Date.now()-startedAt}));return {status:"UNKNOWN",errorCode}}
    finally{clearTimeout(timeout)}
  }
}

function externalReference(value:unknown):string|undefined{if(!value||typeof value!=="object")return undefined;const record=value as Record<string,unknown>;for(const key of ["id","codigo","lead","chave"]){const candidate=record[key];if(typeof candidate==="string"||typeof candidate==="number")return String(candidate).slice(0,200)}return undefined}
function isBusinessError(value:unknown):boolean{if(!value||typeof value!=="object")return false;const record=value as Record<string,unknown>;return record.sucesso===false||record.success===false||record.status===false||typeof record.erro==="string"||typeof record.error==="string"}
function safeErrorSummary(text:string):Record<string,string|number|boolean>|undefined{if(!text)return undefined;try{const value:unknown=JSON.parse(text);if(!value||typeof value!=="object")return {message:redactText(String(value))};const record=value as Record<string,unknown>;const summary:Record<string,string|number|boolean>={};for(const key of ["status","code","error","erro","message","mensagem"]){const item=record[key];if(typeof item==="string")summary[key]=redactText(item);else if(typeof item==="number"||typeof item==="boolean")summary[key]=item}return Object.keys(summary).length?summary:{message:"Resposta de erro sem campos públicos reconhecidos."}}catch{return {message:redactText(text.replace(/\s+/g," ").trim())}}}
function redactText(value:string):string{return value.slice(0,500).replace(/([?&](?:key|token|api[_-]?key)=)[^&\s]+/gi,"$1[REDACTED]").replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,"[REDACTED_EMAIL]").replace(/\+?\d[\d\s().-]{8,}\d/g,"[REDACTED_PHONE]")}
