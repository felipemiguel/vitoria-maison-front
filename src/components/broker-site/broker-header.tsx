import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MobileMenu } from "@/components/layout/mobile-menu";
import type { BrokerLinks } from "./links";

/** Header do site do corretor: marca Maison + nome do corretor. Sem links administrativos. */
export function BrokerHeader({ name, links }: { name: string; links: BrokerLinks }) {
  const items: [string, string][] = ([["Início", links.home], ["Imóveis", links.catalog], ["Sobre", links.about], ["Contato", links.contact]] as [string, string | null][]).filter((item): item is [string, string] => Boolean(item[1]));
  const brand = <span className="flex items-center gap-4"><Logo className="w-[150px] sm:w-[170px]"/><span aria-hidden className="hidden h-8 w-px bg-[#d8cdc4] sm:block"/><span className="hidden text-[11px] uppercase tracking-[.16em] text-[#69635f] sm:block">{name}</span></span>;
  return <header className="border-b border-[#e6ddd6] bg-[#f8f6f2] text-[#181817]">
    <div className="container flex h-20 items-center justify-between gap-6 md:h-24">
      {links.home ? <Link href={links.home} aria-label={`${name} — início`}>{brand}</Link> : brand}
      <nav className="hidden items-center gap-8 lg:flex" aria-label="Navegação do site">{items.map(([label, href]) => <Link key={label} href={href} className="text-[11px] uppercase tracking-[.14em] hover:text-[#66142e]">{label}</Link>)}</nav>
      {items.length > 0 && <MobileMenu links={items} logo={<span className="flex flex-col"><Logo className="w-[170px]"/><span className="mt-2 text-[11px] uppercase tracking-[.16em] text-[#69635f]">{name}</span></span>}/>}
    </div>
  </header>;
}
