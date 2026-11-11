import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/access/server";
import { homePathFor } from "@/features/access/navigation";
import { LoginForm } from "./login-form";

export const metadata = { title: "Acesso administrativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = { "convite=aceito": "Acesso ativado. Entre com o seu e-mail e a nova senha.", "senha=redefinida": "Senha redefinida. Entre com a nova senha.", "senha=alterada": "Senha alterada. Por segurança, entre novamente." };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const notice = Object.entries(query).map(([key, value]) => NOTICES[`${key}=${value}`]).find(Boolean);
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  return <main className="grid min-h-screen place-items-center bg-[#f3eee9] px-5 py-12"><section className="w-full max-w-md rounded-2xl border border-[#e0d6ce] bg-[#fffdfa] p-7 shadow-xl sm:p-9"><p className="font-serif text-3xl tracking-[.08em] text-[#66142e]">VITÓRIA</p><p className="text-[10px] uppercase tracking-[.3em] text-[#b88945]">Maison Admin</p><h1 className="mt-10 text-2xl font-semibold text-[#302724]">Acessar painel</h1><p className="mt-2 text-sm text-[#746c67]">Use o e-mail e a senha do seu acesso.</p>{notice&&<p role="status" className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}<LoginForm/><p className="mt-6 text-center text-sm"><Link href="/admin/recuperar-senha" className="text-[#66142e] underline underline-offset-4">Esqueci minha senha</Link></p></section></main>;
}
