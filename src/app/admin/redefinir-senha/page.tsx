import Link from "next/link";
import { AccessCard } from "@/components/admin/access-card";
import { SetPasswordForm } from "@/components/admin/access-forms";
import { createAccountService } from "@/features/users/factory";

export const metadata = { title: "Redefinir senha", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const usable = await createAccountService().isTokenUsable("PASSWORD_RESET", token);
  if (!usable || !token) return <AccessCard title="Link indisponível" description="Este link é inválido, expirou ou já foi utilizado."><Link href="/admin/recuperar-senha" className="mt-8 block text-center text-sm text-[#66142e] underline underline-offset-4">Solicitar novo link</Link></AccessCard>;
  return <AccessCard title="Redefinir senha" description="Escolha uma nova senha. As sessões abertas serão encerradas."><SetPasswordForm token={token} mode="reset"/></AccessCard>;
}
