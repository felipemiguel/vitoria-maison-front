import { Mail, MessageCircle } from "lucide-react";
import { InterestForm } from "@/components/contact/interest-form";
import { brokerWhatsappLink } from "@/features/brokers/contact";
import type { BrokerSiteView } from "@/features/brokers/public-site-service";
import { firstName } from "./links";
import { brokerLeadsEnabled } from "@/features/leads/config";

/** Aviso honesto enquanto não houver atribuição de leads ao corretor (Fase 6.4D). */
export const LEAD_ROUTING_NOTICE = "Mensagens enviadas por este formulário são recebidas pela equipe Vitória Maison, que direciona o atendimento.";

/** Formulários desligados (BROKER_LEADS_ENABLED=false): feedback claro em vez de um formulário que falharia. */
export function BrokerLeadsUnavailable({ hasDirectContact, dark = false }: { hasDirectContact: boolean; dark?: boolean }) {
  return <div className={`p-7 text-sm leading-6 ${dark ? "bg-white/10 text-white/80" : "bg-[#f0eae4] text-[#69635f]"}`}><p className={`serif text-2xl ${dark ? "text-white" : "text-[#181817]"}`}>Formulário em preparação</p><p className="mt-3">{hasDirectContact ? "Por enquanto, fale comigo pelo WhatsApp ou e-mail desta página." : "Em breve você poderá enviar sua mensagem por aqui."}</p></div>;
}

/**
 * Seção 06: contato em fundo vinho. WhatsApp e e-mail só aparecem quando configurados no perfil.
 * O formulário usa a integração de leads existente (lead da Vitória Maison; a origem é marcada no servidor).
 */
export function BrokerContact({ site, preview = false }: { site: BrokerSiteView; preview?: boolean }) {
  const whatsapp = brokerWhatsappLink(site.whatsapp, { brokerName: site.displayName });
  return <section id="contato" className="scroll-mt-24 bg-[#66142e] py-20 text-white md:py-28"><div className="container grid gap-14 lg:grid-cols-[1fr_440px]">
    <div>
      <p className="text-[11px] uppercase tracking-[.22em] text-white/65">Fale comigo</p>
      <h2 className="serif section-title mt-5 max-w-2xl">Vamos encontrar o imóvel ideal?</h2>
      <p className="mt-6 max-w-lg whitespace-pre-line leading-7 text-white/75">{site.serviceText ?? "Me conte o que você procura e vamos encontrar juntos o imóvel certo para você."}</p>
      <p className="mt-10 serif text-3xl">{site.displayName}</p>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
        {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-3 border border-white px-6 text-xs uppercase tracking-[.12em] hover:bg-white/10"><MessageCircle size={17} aria-hidden/> Conversar no WhatsApp</a>}
        {site.emailPublic && <a href={`mailto:${site.emailPublic}`} className="inline-flex min-h-12 items-center gap-3 border border-white/40 px-6 text-xs tracking-[.04em] hover:bg-white/10"><Mail size={17} aria-hidden/> {site.emailPublic}</a>}
      </div>
    </div>
    <div className="text-[#181817]">
      {preview ? <div className="bg-[#f0eae4] p-7 text-sm text-[#69635f]">Formulário de contato (desativado na prévia).</div>
        : brokerLeadsEnabled() ? <InterestForm variant="broker" type="GENERAL_CONTACT" sourcePage="/" title="Fale comigo" message={`Olá, ${firstName(site.displayName)}! Vi seu site e gostaria de conversar sobre imóveis.`}/> : <BrokerLeadsUnavailable dark hasDirectContact={Boolean(whatsapp || site.emailPublic)}/>}
      {brokerLeadsEnabled() && <p className="mt-4 text-xs leading-5 text-white/65">{LEAD_ROUTING_NOTICE}</p>}
    </div>
  </div></section>;
}
