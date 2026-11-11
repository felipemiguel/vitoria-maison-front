import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MobileMenu } from "./mobile-menu";

export const NAV_LINKS: [string, string][] = [["Comprar","/comprar"],["Alugar","/alugar"],["Investir","/investir"],["Coleções","/colecoes"],["A Vitória","/sobre"],["Perspectivas","/perspectivas"]];
export function Header(){return <header className="absolute z-30 w-full border-b border-[#e6ddd6] bg-[#f8f6f2]/95 text-[#181817] backdrop-blur-sm"><div className="container flex h-24 items-center justify-between"><Link href="/" aria-label="Vitória Maison — início"><Logo className="w-[190px] sm:w-[220px]"/></Link><nav className="hidden items-center gap-7 lg:flex" aria-label="Principal">{NAV_LINKS.map(([label,href])=><Link key={href} href={href} className="text-[11px] uppercase tracking-[.13em] hover:text-[#66142e]">{label}</Link>)}</nav><Link href="/contato" className="hidden items-center gap-2 text-[11px] uppercase tracking-[.13em] text-[#66142e] lg:flex">Contato <ArrowUpRight size={14}/></Link><MobileMenu links={NAV_LINKS} logo={<Logo className="w-[210px]"/>}/></div></header>}
