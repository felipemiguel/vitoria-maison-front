"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FolderHeart, Inbox, LayoutDashboard, Menu, PlusCircle, Search, Sparkles, UserRound, Users, X } from "lucide-react";
import { useState } from "react";
import type { AdminNavIcon } from "@/features/access/navigation";

const icons: Record<AdminNavIcon, typeof LayoutDashboard> = { dashboard: LayoutDashboard, properties: Building2, vista: Search, import: PlusCircle, highlights: Sparkles, collections: FolderHeart, leads: Inbox, users: Users, account: UserRound };

/** Os itens chegam filtrados pelo servidor conforme as permissões. Esconder itens não é controle de acesso. */
export function AdminSidebar({ items }: { items: { href: string; label: string; icon: AdminNavIcon }[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeHref = items.filter(({href})=>pathname===href||(href!=="/admin"&&pathname.startsWith(`${href}/`))).sort((a,b)=>b.href.length-a.href.length)[0]?.href;
  const navigation = <nav aria-label="Navegação administrativa" className="mt-8 space-y-1">{items.map(({href,label,icon})=>{const Icon=icons[icon];const active=href===activeHref;return <Link aria-current={active?"page":undefined} onClick={()=>setOpen(false)} key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#d3a865] ${active?"bg-white/12 text-white":"text-white/70 hover:bg-white/8 hover:text-white"}`}><Icon size={18}/>{label}</Link>})}</nav>;
  return <>
    <button type="button" aria-label="Abrir menu" onClick={()=>setOpen(true)} className="fixed left-4 top-4 z-40 grid size-10 place-items-center rounded-lg bg-[#66142e] text-white lg:hidden"><Menu size={20}/></button>
    {open&&<button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={()=>setOpen(false)}/>} 
    <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#66142e] p-6 text-white transition-transform lg:translate-x-0 ${open?"translate-x-0":"-translate-x-full"}`}>
      <div className="flex items-start justify-between"><div><p className="font-serif text-2xl tracking-[.08em]">VITÓRIA</p><p className="text-[10px] uppercase tracking-[.3em] text-[#d3a865]">Maison Admin</p></div><button aria-label="Fechar menu" onClick={()=>setOpen(false)} className="lg:hidden"><X/></button></div>{navigation}
      <p className="absolute bottom-6 left-6 text-[10px] uppercase tracking-[.12em] text-white/45">Ambiente administrativo</p>
    </aside>
  </>;
}
