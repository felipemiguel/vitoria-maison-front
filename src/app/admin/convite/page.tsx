import Link from "next/link";
import { AccessCard } from "@/components/admin/access-card";
import { SetPasswordForm } from "@/components/admin/access-forms";
import { createAccountService } from "@/features/users/factory";

export const metadata = { title: "Ativar acesso", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const usable = await createAccountService().isTokenUsable("INVITE", token);
  if (!usable || !token) return <AccessCard title="Link indisponível" description="Este convite é inválido, expirou ou já foi utilizado. Peça a um administrador que envie um novo convite."><Link href="/admin/login" className="mt-8 block text-center text-sm text-[#66142e] underline underline-offset-4">Ir para o login</Link></AccessCard>;
  return <AccessCard title="Ative seu acesso" description="Defina a senha que você usará para entrar no painel Vitória Maison."><SetPasswordForm token={token} mode="invite"/></AccessCard>;
}
