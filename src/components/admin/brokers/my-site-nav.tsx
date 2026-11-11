"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [["Painel", "/admin/meu-site"], ["Perfil", "/admin/meu-site/perfil"], ["Página inicial", "/admin/meu-site/pagina"], ["Imóveis", "/admin/meu-site/imoveis"], ["Prévia", "/admin/meu-site/previa"], ["Leads", "/admin/meu-site/leads"]] as const;

export function MySiteNav({ hasSite }: { hasSite: boolean }) {
  const pathname = usePathname();
  return <nav aria-label="Seções de Meu site" className="-mx-1 flex gap-1 overflow-x-auto border-b border-[#e4dcd5] px-1">{TABS.filter(([, href]) => hasSite || href === "/admin/meu-site" || href === "/admin/meu-site/perfil").map(([label, href]) => {
    const active = href === "/admin/meu-site" ? pathname === href : pathname.startsWith(href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${active ? "border-[#66142e] text-[#66142e]" : "border-transparent text-[#746c67] hover:text-[#302724]"}`}>{label}</Link>;
  })}</nav>;
}
