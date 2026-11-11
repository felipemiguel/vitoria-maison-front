import { z } from "zod";

const optionalText=(max:number)=>z.string().trim().max(max).transform((value)=>value||undefined);
export const leadInputSchema=z.object({
  type:z.enum(["PROPERTY_INTEREST","GENERAL_CONTACT","OWNER_CONTACT","INVESTMENT_CONSULTING"]),
  name:z.string().trim().min(2,"Informe seu nome.").max(160),
  email:optionalText(320).pipe(z.email("Informe um e-mail válido.").optional()),
  phone:optionalText(40).refine((value)=>!value||/^\+?[\d\s().-]+$/.test(value)&&value.replace(/\D/g,"").length>=10&&value.replace(/\D/g,"").length<=15,"Informe um telefone válido com DDD."),
  // Opcional: vazio recebe uma mensagem padrão no servidor (o Vista exige "mensagem").
  message:z.string().trim().max(2_000).optional().transform((value)=>value||undefined).refine((value)=>!value||value.length>=3,"A mensagem precisa ter pelo menos 3 caracteres."),
  propertyId:z.string().uuid("Referência de imóvel inválida.").optional(),
  vehicle:z.string().trim().max(200).optional().transform((value)=>value||undefined),
  sourcePage:z.string().trim().min(1).max(300).regex(/^\/[a-z0-9/_?=&.%~-]*$/i,"Origem inválida."),
  submissionKey:z.string().uuid("Identificador de envio inválido."),
  website:z.string().max(0,"Envio rejeitado."),
}).superRefine((value,ctx)=>{
  if(!value.email&&!value.phone)ctx.addIssue({code:"custom",path:["email"],message:"Informe um e-mail ou WhatsApp."});
  if(value.type==="PROPERTY_INTEREST"&&!value.propertyId)ctx.addIssue({code:"custom",path:["propertyId"],message:"O imóvel não foi identificado."});
  if(value.type!=="PROPERTY_INTEREST"&&value.propertyId)ctx.addIssue({code:"custom",path:["propertyId"],message:"Imóvel não permitido para esta origem."});
  if(value.type!=="PROPERTY_INTEREST"&&!value.vehicle)ctx.addIssue({code:"custom",path:["vehicle"],message:"Informe o imóvel ou objetivo de interesse."});
});

export type ValidatedLeadInput=Omit<z.infer<typeof leadInputSchema>,"website">;
