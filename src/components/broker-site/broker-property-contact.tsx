import { MessageCircle } from "lucide-react";
import { InterestForm } from "@/components/contact/interest-form";
import { brokerWhatsappLink } from "@/features/brokers/contact";
import type { BrokerSiteView } from "@/features/brokers/public-site-service";
import type { Property } from "@/features/properties/types";
import { BrokerPortrait } from "./broker-portrait";
import { BrokerLeadsUnavailable, LEAD_ROUTING_NOTICE } from "./broker-contact";
import { brokerLeadsEnabled } from "@/features/leads/config";
import { firstName } from "./links";

/** Coluna de contato da página de imóvel no site do corretor. */
export function BrokerPropertyContact({ site, property, propertyUrl, preview = false }: { site: BrokerSiteView; property: Property; propertyUrl: string | null; preview?: boolean }) {
  const whatsapp = brokerWhatsappLink(site.whatsapp, { brokerName: site.displayName, propertyCode: property.commercial.code, propertyUrl });
  return <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
    <div className="grid grid-cols-[88px_1fr] items-center gap-5 border border-[#e6ddd6] bg-white p-5">
      <BrokerPortrait name={site.displayName} url={site.profileImageUrl} sizes="88px" compact/>
      <div><p className="text-[10px] uppercase tracking-[.16em] text-[#69635f]">Seu contato</p><p className="serif mt-1 text-2xl leading-tight">{site.displayName}</p>{site.professionalTitle && <p className="mt-1 text-xs text-[#69635f]">{site.professionalTitle}</p>}</div>
      {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn col-span-2 w-full"><MessageCircle size={16} aria-hidden/> Fale comigo no WhatsApp</a>}
    </div>
    {preview ? <div className="bg-[#f0eae4] p-7 text-sm text-[#69635f]">Formulário de interesse (desativado na prévia).</div>
      : brokerLeadsEnabled() ? <InterestForm variant="broker" propertyId={property.id} code={property.commercial.code} sourcePage={`/imoveis/${property.slug}`} title="Tenho interesse neste imóvel" message={`Olá, ${firstName(site.displayName)}! Gostaria de mais informações sobre este imóvel.`}/> : <BrokerLeadsUnavailable hasDirectContact={Boolean(whatsapp || site.emailPublic)}/>}
    {brokerLeadsEnabled() && <p className="text-xs leading-5 text-[#69635f]">{LEAD_ROUTING_NOTICE}</p>}
  </aside>;
}
