import { describe, expect, it } from "vitest";
import { leadInputSchema } from "./validation";
const valid={type:"GENERAL_CONTACT",name:"Maria Silva",email:"maria@example.com",phone:"",message:"Olá",vehicle:"Apartamento em Moema",sourcePage:"/contato",submissionKey:"00000000-0000-4000-8000-000000000001",website:""};
describe("validação de leads",()=>{
  it("aceita lead válido com um meio de contato",()=>expect(leadInputSchema.parse(valid).email).toBe("maria@example.com"));
  it("exige nome",()=>expect(()=>leadInputSchema.parse({...valid,name:""})).toThrow(/nome/i));
  it("rejeita e-mail inválido",()=>expect(()=>leadInputSchema.parse({...valid,email:"inválido"})).toThrow(/e-mail/i));
  it("rejeita telefone inválido",()=>expect(()=>leadInputSchema.parse({...valid,email:"",phone:"123"})).toThrow(/telefone/i));
  it("exige ao menos um meio de contato",()=>expect(()=>leadInputSchema.parse({...valid,email:"",phone:""})).toThrow(/e-mail ou WhatsApp/i));
  it("exige imóvel no interesse imobiliário",()=>expect(()=>leadInputSchema.parse({...valid,type:"PROPERTY_INTEREST"})).toThrow(/imóvel/i));
  it("rejeita honeypot preenchido",()=>expect(()=>leadInputSchema.parse({...valid,website:"spam"})).toThrow(/rejeitado/i));
});
