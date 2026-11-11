import { AccessCard } from "@/components/admin/access-card";
import { RequestResetForm } from "@/components/admin/access-forms";

export const metadata = { title: "Recuperar senha", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <AccessCard title="Recuperar senha" description="Informe o e-mail do seu acesso. Se houver uma conta ativa, enviaremos um link válido por 60 minutos."><RequestResetForm/></AccessCard>;
}
