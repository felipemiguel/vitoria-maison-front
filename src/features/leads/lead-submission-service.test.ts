import { describe,expect,it,vi } from "vitest";
import type { DrizzleLeadStore } from "./drizzle-lead-store";
import { LeadSubmissionService, assignmentAfterDelivery } from "./lead-submission-service";
import type { LeadOrigin } from "./types";
import type { LeadProvider } from "./types";
const input={type:"PROPERTY_INTEREST",name:"Maria Silva",email:"maria@example.com",phone:"",message:"Interesse",propertyId:"00000000-0000-4000-8000-000000000031",sourcePage:"/imoveis/apartamento",submissionKey:"00000000-0000-4000-8000-000000000001",website:""};
function setup(published=true,result:{status:"MOCKED"|"DELIVERED"|"FAILED"|"UNKNOWN";errorCode?:string}={status:"MOCKED"}){const store={resolvePublishedProperty:vi.fn(async()=>published?{id:input.propertyId,vistaCode:"31",title:null,sourceTitle:"Apartamento"}:null),create:vi.fn(async()=>({id:"00000000-0000-4000-8000-000000000099",status:"PENDING",created:true})),recordDelivery:vi.fn(async()=>undefined)};const provider:LeadProvider={sendLead:vi.fn(async()=>result)};return {store,provider,service:new LeadSubmissionService(store as unknown as DrizzleLeadStore,provider,"test-secret",()=>new Date("2026-11-08T12:00:00Z"))}}
describe("LeadSubmissionService",()=>{
  it("resolve o código Vista no servidor e registra antes de entregar",async()=>{const {service,store,provider}=setup();const response=await service.submit(input,"session-1");expect(response.status).toBe("MOCKED");expect(store.create).toHaveBeenCalledWith(expect.objectContaining({propertyVistaCode:"31"}),expect.any(Date));expect(provider.sendLead).toHaveBeenCalledWith(expect.objectContaining({propertyVistaCode:"31"}));expect(store.recordDelivery).toHaveBeenCalled()});
  it("recusa imóvel inexistente ou fora do catálogo público",async()=>{const {service,store,provider}=setup(false);await expect(service.submit(input,"session-1")).rejects.toThrow(/não está disponível/);expect(store.create).not.toHaveBeenCalled();expect(provider.sendLead).not.toHaveBeenCalled()});
  it("informa entrega pendente sem afirmar sucesso",async()=>{const {service}=setup(true,{status:"UNKNOWN",errorCode:"TIMEOUT"});const response=await service.submit(input,"session-1");expect(response.status).toBe("UNKNOWN");expect(response.message).toMatch(/aguardando confirmação/)});

  describe("origem de site de corretor (6.4D)",()=>{
    const origin:LeadOrigin={source:"BROKER_SITE",hostname:"ana.vitoriamaison.com.br",path:"/imoveis/apto",brokerSiteId:"00000000-0000-4000-8000-0000000000a1",brokerUserId:"00000000-0000-4000-8000-0000000000b1",subdomain:"ana",vistaBrokerCode:"3"};
    const brokerInput={...input,phone:"11999998888",message:""};
    it("valida o imóvel no escopo do site, grava a origem e encaminha o código do corretor ao provider",async()=>{const {service,store,provider}=setup(true,{status:"DELIVERED"});await service.submit(brokerInput,"s",origin);
      expect(store.resolvePublishedProperty).toHaveBeenCalledWith(input.propertyId,expect.any(Date),origin.brokerSiteId);
      expect(store.create).toHaveBeenCalledWith(expect.objectContaining({origin,message:"Tenho interesse neste imóvel."}),expect.any(Date));
      expect(provider.sendLead).toHaveBeenCalledWith(expect.objectContaining({vistaBrokerCode:"3"}));
      expect(store.recordDelivery).toHaveBeenCalledWith(expect.any(String),expect.anything(),expect.any(Number),expect.any(Date),{status:"UNVERIFIED",returnedCode:null})});
    it("imóvel fora da seleção do site é recusado sem registrar nem enviar",async()=>{const {service,store,provider}=setup(false);await expect(service.submit(brokerInput,"s",origin)).rejects.toThrow(/neste site/);expect(store.create).not.toHaveBeenCalled();expect(provider.sendLead).not.toHaveBeenCalled()});
    it("exige WhatsApp ou telefone no site do corretor",async()=>{const {service,store}=setup();await expect(service.submit({...brokerInput,phone:""},"s",origin)).rejects.toThrow(/WhatsApp ou telefone/);expect(store.create).not.toHaveBeenCalled()});
    it("o mesmo contato em dois sites diferentes não é deduplicado entre si",async()=>{const {service,store}=setup();await service.submit(brokerInput,"s",origin);await service.submit({...brokerInput,submissionKey:"00000000-0000-4000-8000-000000000002"},"s",{...origin,brokerSiteId:"00000000-0000-4000-8000-0000000000a2"});const [first,second]=store.create.mock.calls.map((call)=>(call as unknown as [{deduplicationHash:string}])[0].deduplicationHash);expect(first).not.toBe(second)});
    it("campos de origem enviados pelo navegador são ignorados (o schema não os aceita como origem)",async()=>{const {service,store}=setup();await service.submit({...brokerInput,brokerUserId:"x",brokerSiteId:"y",source:"BROKER_SITE"},"s");expect(store.create).toHaveBeenCalledWith(expect.objectContaining({origin:{source:"MAISON_SITE",hostname:null,path:input.sourcePage}}),expect.any(Date))});
  });

  describe("assignmentAfterDelivery",()=>{
    const base={origin:"BROKER_SITE" as const,expectedCode:"3",verification:true};
    it("Maison: não se aplica",()=>{expect(assignmentAfterDelivery({...base,origin:"MAISON_SITE",result:{status:"DELIVERED"}})).toBeUndefined()});
    it("sem entrega confirmada: continua pendente",()=>{expect(assignmentAfterDelivery({...base,result:{status:"UNKNOWN"}})?.status).toBe("PENDING");expect(assignmentAfterDelivery({...base,result:{status:"FAILED"}})?.status).toBe("PENDING")});
    it("contrato não confirmado: UNVERIFIED mesmo que o Vista devolva o mesmo corretor",()=>{expect(assignmentAfterDelivery({...base,verification:false,result:{status:"DELIVERED",brokerCode:"3"}})).toEqual({status:"UNVERIFIED",returnedCode:"3"})});
    it("contrato confirmado: CONFIRMED quando coincide",()=>{expect(assignmentAfterDelivery({...base,result:{status:"DELIVERED",brokerCode:"3"}})?.status).toBe("CONFIRMED")});
    it("divergência de corretor (ex.: cliente existente com outro corretor): MISMATCH",()=>{expect(assignmentAfterDelivery({...base,result:{status:"DELIVERED",brokerCode:"9"}})).toEqual({status:"MISMATCH",returnedCode:"9"})});
    it("sem código do corretor ou sem retorno do Vista: UNVERIFIED",()=>{expect(assignmentAfterDelivery({...base,expectedCode:null,result:{status:"DELIVERED",brokerCode:"3"}})?.status).toBe("UNVERIFIED");expect(assignmentAfterDelivery({...base,result:{status:"DELIVERED"}})?.status).toBe("UNVERIFIED")});
    it("ambiente de teste (mock): UNVERIFIED",()=>{expect(assignmentAfterDelivery({...base,result:{status:"MOCKED"}})?.status).toBe("UNVERIFIED")});
  });
});
