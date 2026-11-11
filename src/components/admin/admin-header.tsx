import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";

export function AdminHeader({ title, userName, roleLabels }: { title: string; userName: string; roleLabels: string[] }) {
  return <header className="flex min-h-16 items-center justify-between border-b border-[#e4dcd5] bg-white px-5 pl-16 lg:px-8"><h1 className="text-lg font-semibold text-[#302724]">{title}</h1><div className="flex items-center gap-4"><Link href="/admin/minha-conta" className="hidden text-right sm:block"><span className="block text-sm text-[#302724]">{userName}</span><span className="block text-[11px] text-[#8b817b]">{roleLabels.length?roleLabels.join(" · "):"Sem perfil"}</span></Link><form action={logoutAction}><button className="flex items-center gap-2 rounded-lg border border-[#ded4cc] px-3 py-2 text-xs font-medium text-[#66142e] hover:bg-[#f7f2ee]"><LogOut size={15}/> Sair</button></form></div></header>;
}
