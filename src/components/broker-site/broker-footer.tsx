import { Logo } from "@/components/brand/logo";
import { companyInfo } from "@/lib/config/company";
import { absoluteUrl, getSeoConfig } from "@/features/seo/config";

/** Rodapé: o corretor em primeiro plano, a marca e a imobiliária responsável sempre visíveis. */
export function BrokerFooter({ name }: { name: string }) {
  const seo = getSeoConfig();
  const institutional = absoluteUrl(seo, "/");
  const privacy = absoluteUrl(seo, "/privacidade");
  return <footer className="border-t border-[#e6ddd6] bg-[#f0eae4]"><div className="container grid gap-10 py-14 md:grid-cols-[1.2fr_1fr]">
    <div><Logo className="w-[200px]"/><p className="mt-5 max-w-sm text-sm leading-6 text-[#69635f]">Site de {name}, corretor(a) parceiro(a) da Vitória Maison.</p>{institutional && <a href={institutional} className="link-line mt-6">Conheça a Vitória Maison</a>}</div>
    <div className="text-sm leading-6 text-[#69635f] md:pt-2"><p className="font-semibold text-[#181817]">{companyInfo.group}</p><p>Imobiliária responsável · CRECI {companyInfo.creci}</p><p className="mt-3">{companyInfo.address.street}, {companyInfo.address.neighborhood}<br/>{companyInfo.address.city} - {companyInfo.address.state}</p>{privacy && <a href={privacy} className="mt-4 inline-block underline underline-offset-4">Política de Privacidade</a>}</div>
  </div><div className="container border-t border-[#d8cdc4] py-6 text-[11px] uppercase tracking-[.12em] text-[#69635f]">© {new Date().getFullYear()} Vitória Maison</div></footer>;
}
