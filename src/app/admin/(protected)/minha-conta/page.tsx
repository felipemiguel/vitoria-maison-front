import { notFound } from "next/navigation";
import { Globe2, ShieldCheck } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { ROLE_LABELS } from "@/features/access/permissions";
import { createAccountService } from "@/features/users/factory";
import { PasswordForm, ProfileForm } from "@/components/admin/account/account-forms";

export const metadata = { title: "Minha conta" };
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value) : "—";

/** Área pessoal: o usuário vê os próprios dados e perfis, mas não pode alterar perfis nem status. */
export default async function MyAccountPage() {
  const user = await requirePagePermission("account:manage-own");
  const account = await createAccountService().getOwnAccount(user);
  if (!account) notFound();
  const card = "rounded-xl border border-[#ded5cd] bg-white p-5 sm:p-6";
  return <div className="mx-auto max-w-4xl space-y-6">
    <div><h2 className="text-2xl font-semibold">Minha conta</h2><p className="mt-1 text-sm text-[#746c67]">Seus dados de acesso ao painel Vitória Maison.</p></div>
    <section className={card}><dl className="grid gap-4 text-sm sm:grid-cols-3">
      <div><dt className="text-xs text-[#817872]">E-mail</dt><dd className="mt-1 break-all">{account.email}</dd></div>
      <div><dt className="text-xs text-[#817872]">Conta criada em</dt><dd className="mt-1">{date(account.createdAt)}</dd></div>
      <div><dt className="text-xs text-[#817872]">Último acesso</dt><dd className="mt-1">{date(account.lastLoginAt)}</dd></div>
    </dl>
      <div className="mt-5 border-t border-[#f1ebe6] pt-5"><p className="flex items-center gap-2 text-xs text-[#817872]"><ShieldCheck size={15}/> Perfis atribuídos</p><div className="mt-2 flex flex-wrap gap-2">{user.roles.length ? user.roles.map((role) => <span key={role} className="rounded-full bg-[#f4ece6] px-3 py-1 text-sm text-[#66142e]">{ROLE_LABELS[role]}</span>) : <span className="text-sm text-[#746c67]">Nenhum perfil atribuído.</span>}</div><p className="mt-3 text-xs text-[#817872]">Perfis e e-mail são alterados apenas por um administrador.</p></div>
    </section>
    <section className={card}><h3 className="font-semibold">Dados pessoais</h3><div className="mt-4"><ProfileForm name={account.name}/></div></section>
    <section className={card}><h3 className="font-semibold">Senha</h3><div className="mt-4"><PasswordForm/></div></section>
    {user.roles.includes("BROKER") && <section className={`${card} bg-[#fbf7f4]`}><h3 className="flex items-center gap-2 font-semibold"><Globe2 size={17}/> Seu site de corretor</h3><p className="mt-2 text-sm leading-6 text-[#746c67]">Em breve, cada corretor da Vitória Maison terá um site próprio, com seleção de imóveis da curadoria e contatos direcionados a você. Quando estiver disponível, a configuração aparecerá aqui.</p></section>}
  </div>;
}
