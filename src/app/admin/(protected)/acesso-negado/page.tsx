import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requirePageUser } from "@/features/access/server";
import { homePathFor } from "@/features/access/navigation";

export const metadata = { title: "Acesso negado" };

export default async function AccessDeniedPage() {
  const user = await requirePageUser();
  return <div className="mx-auto max-w-xl rounded-xl border border-[#ded5cd] bg-white p-8 text-center"><ShieldAlert className="mx-auto text-[#66142e]" size={36}/><h2 className="mt-4 text-xl font-semibold">Acesso não permitido</h2><p className="mt-2 text-sm leading-6 text-[#746c67]">Seu perfil não tem permissão para acessar esta área. Se precisar desse acesso, fale com um administrador.</p><Link href={homePathFor(user)} className="mt-6 inline-flex rounded-lg bg-[#66142e] px-5 py-2.5 text-sm font-semibold text-white">Voltar ao início</Link></div>;
}
