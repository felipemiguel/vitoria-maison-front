"use client";
import { randomUuid } from "@/lib/random-id";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { submitLeadAction, type LeadActionState } from "@/app/lead-actions";
import type { LeadType } from "@/features/leads/types";
import { TrackEvent } from "@/components/analytics/track-event";

type Props={type?:LeadType;propertyId?:string;code?:string;sourcePage:string;title?:string;ownerFields?:boolean;message?:string;
  /** "broker": site de corretor (WhatsApp obrigatório, e-mail e mensagem opcionais, sem motivo do contato). */
  variant?:"maison"|"broker"};
const initial:LeadActionState={};
const contactReasons=["Comprar um imóvel","Alugar um imóvel","Investir em imóveis","Anunciar um imóvel","Avaliar um imóvel","Outros assuntos"];

export function InterestForm({type="PROPERTY_INTEREST",propertyId,code,sourcePage,title,ownerFields=false,message,variant="maison"}:Props){const broker=variant==="broker";
  const [state,action,pending]=useActionState(submitLeadAction,initial);const [phone,setPhone]=useState("");const submissionKeyRef=useRef<HTMLInputElement>(null);
  // Analytics: somente tipo, origem, código do imóvel e situação. Nenhum campo digitado é enviado.
  if(state.ok)return <><TrackEvent name="generate_lead" params={{lead_type:type,source_page:sourcePage,property_code:code,delivery_status:state.status}}/><SuccessConfirmation type={type} status={state.status} broker={broker}/></>;
  return <form action={action} onSubmit={()=>{if(submissionKeyRef.current&&!submissionKeyRef.current.value)submissionKeyRef.current.value=randomUuid()}} className="bg-[#f0eae4] p-7" aria-label={title??"Formulário de contato"}>
    <h3 className="serif text-3xl">{title??(type==="PROPERTY_INTEREST"?"Tenho interesse neste imóvel":"Fale com a nossa equipe")}</h3>{code&&<p className="mt-2 text-xs text-[#69635f]">Referência {code}</p>}
    <input type="hidden" name="type" value={type}/><input type="hidden" name="propertyId" value={propertyId??""}/><input type="hidden" name="sourcePage" value={sourcePage}/><input ref={submissionKeyRef} type="hidden" name="submissionKey"/><label className="absolute -left-[10000px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
    <Field name="name" label="Nome" autoComplete="name" required error={state.fields?.name?.[0]}/><Field name="phone" label={broker?"WhatsApp ou telefone":"WhatsApp (ou e-mail)"} type="tel" autoComplete="tel" placeholder="(11) 99999-9999" required={broker} value={phone} onChange={setPhone} error={state.fields?.phone?.[0]}/><Field name="email" label={broker?"E-mail (opcional)":"E-mail (ou WhatsApp)"} type="email" autoComplete="email" required={!broker&&!phone.trim()} error={state.fields?.email?.[0]}/>
    {type==="GENERAL_CONTACT"&&broker&&<input type="hidden" name="vehicle" value="Contato pelo site do corretor"/>}
    {type==="GENERAL_CONTACT"&&!broker&&<SelectField name="vehicle" label="Motivo do contato" options={contactReasons} required error={state.fields?.vehicle?.[0]}/>}
    {type==="INVESTMENT_CONSULTING"&&<Field name="vehicle" label="Perfil de imóvel procurado" required error={state.fields?.vehicle?.[0]}/>}
    {ownerFields&&<div className="grid gap-x-4 sm:grid-cols-2"><Field name="location" label="Bairro ou localização" required/><Field name="propertyType" label="Tipo de imóvel" required error={state.fields?.vehicle?.[0]}/><label className="mt-5 block text-[10px] uppercase tracking-[.13em] sm:col-span-2">Interesse *<select name="ownerIntent" required className="mt-2 h-12 w-full border-b border-[#d3a865] bg-transparent text-base normal-case outline-none focus:border-[#66142e]"><option value="">Selecione</option><option>Venda</option><option>Locação</option><option>Avaliação</option></select></label></div>}
    <label className="mt-5 block text-[10px] uppercase tracking-[.13em]">{broker?"Mensagem (opcional)":"Mensagem *"}<textarea name="message" rows={4} required={!broker} minLength={broker?undefined:3} maxLength={2000} className="mt-2 w-full border-b border-[#d3a865] bg-transparent text-base normal-case outline-none focus:border-[#66142e]" defaultValue={message??defaultMessage(type)}/>{state.fields?.message?.[0]&&<span className="mt-1 block normal-case tracking-normal text-red-700">{state.fields.message[0]}</span>}</label>
    {state.error&&<p role="alert" className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm normal-case tracking-normal text-red-800">{state.error}</p>}
    <p className="mt-5 text-xs leading-5 text-[#69635f]">Usaremos seus dados somente para responder a esta solicitação. Isso não autoriza comunicações promocionais. Consulte nossa <Link href="/privacidade" className="underline">Política de Privacidade</Link>.</p>
    <button disabled={pending} className="btn mt-6 flex w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60">{pending&&<Loader2 size={16} className="animate-spin"/>}{pending?"Enviando…":type==="PROPERTY_INTEREST"?"Enviar interesse":"Enviar solicitação"}</button>
  </form>
}

function Field({name,label,type="text",autoComplete,required=false,placeholder,error,value,onChange}:{name:string;label:string;type?:string;autoComplete?:string;required?:boolean;placeholder?:string;error?:string;value?:string;onChange?:(value:string)=>void}){return <label className="mt-5 block text-[10px] uppercase tracking-[.13em]">{label}{required&&" *"}<input name={name} required={required} type={type} autoComplete={autoComplete} placeholder={placeholder} maxLength={type==="email"?320:160} aria-invalid={Boolean(error)} {...(value!==undefined?{value,onChange:(event:React.ChangeEvent<HTMLInputElement>)=>onChange?.(event.target.value)}:{})} className="mt-2 h-12 w-full border-b border-[#d3a865] bg-transparent text-base normal-case outline-none placeholder:text-[#9a918b] focus:border-[#66142e]"/>{error&&<span className="mt-1 block normal-case tracking-normal text-red-700">{error}</span>}</label>}

function SelectField({name,label,options,required=false,error}:{name:string;label:string;options:string[];required?:boolean;error?:string}){return <label className="mt-5 block text-[10px] uppercase tracking-[.13em]">{label}{required&&" *"}<select name={name} required={required} defaultValue="" aria-invalid={Boolean(error)} className="mt-2 h-12 w-full border-b border-[#d3a865] bg-transparent text-base normal-case outline-none focus:border-[#66142e]"><option value="" disabled>Selecione uma opção</option>{options.map((option)=><option value={option} key={option}>{option}</option>)}</select>{error&&<span className="mt-1 block normal-case tracking-normal text-red-700">{error}</span>}</label>}

function defaultMessage(type:LeadType){
  if(type==="PROPERTY_INTEREST")return "Gostaria de mais informações sobre este imóvel.";
  if(type==="INVESTMENT_CONSULTING")return "Gostaria de conversar com um especialista sobre oportunidades de investimento.";
  if(type==="OWNER_CONTACT")return "Gostaria de conversar com a equipe sobre o meu imóvel.";
  return "Olá, gostaria de conversar com a equipe da Vitória Maison.";
}

function SuccessConfirmation({type,status,broker=false}:{type:LeadType;status?:string;broker?:boolean}){
  const pending=status==="FAILED"||status==="UNKNOWN"||status==="PENDING";
  const copy=pending
    ?{title:"Sua solicitação está registrada.",description:"Seus dados foram salvos com segurança e nossa equipe acompanhará o envio. Não é necessário preencher o formulário novamente."}
    :broker?brokerSuccessCopy(type):successCopy(type);
  return <section role="status" aria-live="polite" className="relative overflow-hidden bg-[#66142e] px-7 py-9 text-white sm:px-9 sm:py-11">
    <div aria-hidden="true" className="absolute -right-16 -top-16 h-44 w-44 rounded-full border border-white/10"/>
    <div className="relative">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d3a865]/70 bg-white/5"><CheckCircle2 size={22} className="text-[#ecc088]"/></div>
      <p className="mt-7 text-[10px] uppercase tracking-[.22em] text-[#ecc088]">Atendimento Vitória Maison</p>
      <h3 className="serif mt-3 text-4xl leading-tight">{copy.title}</h3>
      <p className="mt-5 max-w-md text-sm leading-7 text-white/75">{copy.description}</p>
      <div className="mt-7 border-t border-white/15 pt-5"><p className="text-xs leading-5 text-white/60">Em breve, entraremos em contato pelo telefone ou e-mail informado.</p><Link href="/imoveis" className="mt-5 inline-block text-xs font-semibold uppercase tracking-[.13em] text-[#ecc088] underline decoration-[#ecc088]/40 underline-offset-4">Continuar explorando imóveis</Link></div>
      {status==="MOCKED"&&<p className="mt-5 text-[11px] text-white/45">Solicitação registrada no ambiente de testes.</p>}
    </div>
  </section>;
}

/** Site de corretor: não afirma que o lead chegou ao corretor no Vista (a atribuição pode não estar confirmada). */
function brokerSuccessCopy(type:LeadType){return {title:type==="PROPERTY_INTEREST"?"Recebemos seu interesse.":"Recebemos sua mensagem.",description:"Nossa equipe entrará em contato."}}

function successCopy(type:LeadType){
  if(type==="PROPERTY_INTEREST")return {title:"Seu interesse está com a nossa equipe.",description:"Recebemos sua solicitação sobre este imóvel. Um de nossos consultores entrará em contato para apresentar os detalhes e orientar os próximos passos."};
  if(type==="INVESTMENT_CONSULTING")return {title:"Vamos conversar sobre seus próximos passos.",description:"Recebemos seu pedido de consultoria. Nossa equipe analisará o perfil informado antes de entrar em contato com uma curadoria alinhada aos seus objetivos."};
  if(type==="OWNER_CONTACT")return {title:"Recebemos as informações do seu imóvel.",description:"Nossa equipe fará uma análise inicial e entrará em contato para conhecer melhor a propriedade e orientar os próximos passos."};
  return {title:"Sua mensagem chegou até nós.",description:"Obrigado por compartilhar seu objetivo. Nossa equipe irá analisar sua solicitação e retornará com um atendimento personalizado."};
}
