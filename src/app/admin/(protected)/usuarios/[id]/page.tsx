import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { hasPermission, isRoleCode, ROLE_LABELS } from "@/features/access/permissions";
import { createUserManagementService } from "@/features/users/factory";
import { UserForm } from "@/components/admin/users/user-form";
import { ResendInviteForm } from "@/components/admin/users/resend-invite-form";
import { UserStatusBadge } from "@/components/admin/users/user-status-badge";

export const metadata = { title: "Gerenciar usuário" };

const ACTION_LABELS: Record<string, string> = {
  USER_CREATED: "Usuário criado", USER_UPDATED: "Dados atualizados", USER_EMAIL_CHANGED: "E-mail alterado",
  USER_ACTIVATED: "Acesso ativado", USER_DEACTIVATED: "Acesso desativado", ROLE_ADDED: "Perfil atribuído", ROLE_REMOVED: "Perfil removido",
  INVITE_SENT: "Convite emitido", INVITE_ACCEPTED: "Convite aceito", PASSWORD_RESET_REQUESTED: "Recuperação de senha solicitada",
  PASSWORD_RESET_EMAIL: "E-mail de recuperação", PASSWORD_RESET_COMPLETED: "Senha redefinida", PASSWORD_CHANGED: "Senha alterada pelo usuário", PROFILE_UPDATED: "Perfil pessoal atualizado",
};
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value) : "—";

function describe(metadata: Record<string, unknown>): string {
  const parts: string[] = [];
  if (isRoleCode(metadata.role)) parts.push(ROLE_LABELS[metadata.role]);
  if (Array.isArray(metadata.roles)) parts.push(`Perfis: ${metadata.roles.filter(isRoleCode).map((role) => ROLE_LABELS[role]).join(", ") || "nenhum"}`);
  if (typeof metadata.from === "string" && typeof metadata.to === "string") parts.push(`${metadata.from} → ${metadata.to}`);
  if (typeof metadata.delivered === "boolean") parts.push(metadata.delivered ? "e-mail enviado" : "e-mail não enviado (provider não configurado)");
  if (metadata.sessionsRevoked === true) parts.push("sessões encerradas");
  return parts.join(" · ");
}

export default async function UserDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePagePermission("users:read");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await createUserManagementService().get(actor, id);
  if (!user) notFound();
  const isSelf = actor.id === user.id;
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/admin/usuarios" className="inline-flex items-center gap-2 text-sm text-[#746c67]"><ArrowLeft size={16}/> Usuários</Link>
    <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold">{user.name}</h2><UserStatusBadge status={user.status}/>{isSelf && <span className="text-xs text-[#9b6a2f]">Sua conta</span>}</div>
    {query.criado && <p role="status" className={`rounded-lg px-4 py-3 text-sm ${query.convite === "nao-enviado" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>{query.convite === "enviado" ? "Usuário criado e convite enviado por e-mail." : query.convite === "nao-enviado" ? "Usuário criado. O convite foi gerado, mas o e-mail NÃO foi enviado porque o envio não está configurado neste ambiente. Configure o provider e use “Reenviar convite”." : "Usuário criado como inativo. Ative o acesso e reenvie o convite quando apropriado."}</p>}
    <dl className="grid gap-4 rounded-xl border border-[#ded5cd] bg-white p-5 text-sm sm:grid-cols-4">
      <div><dt className="text-xs text-[#817872]">Criado em</dt><dd className="mt-1">{date(user.createdAt)}</dd></div>
      <div><dt className="text-xs text-[#817872]">Último acesso</dt><dd className="mt-1">{date(user.lastLoginAt)}</dd></div>
      <div><dt className="text-xs text-[#817872]">Convite</dt><dd className="mt-1">{user.invitationAcceptedAt ? `Aceito em ${date(user.invitationAcceptedAt)}` : user.hasPassword ? "Conta anterior aos convites" : user.pendingInviteExpiresAt ? `Pendente até ${date(user.pendingInviteExpiresAt)}` : "Sem convite válido"}</dd></div>
      <div><dt className="text-xs text-[#817872]">Senha</dt><dd className="mt-1">{user.hasPassword ? "Definida pelo usuário" : "Ainda não definida"}</dd></div>
    </dl>
    {user.status === "invited" && hasPermission(actor, "users:update") && <section className="rounded-xl border border-[#ded5cd] bg-white p-5"><h3 className="font-semibold">Convite</h3><p className="mt-1 text-sm text-[#746c67]">Gera um novo link (válido por 72 horas) e invalida os anteriores.</p><div className="mt-4"><ResendInviteForm id={user.id}/></div></section>}
    <UserForm mode="edit" user={{ id: user.id, version: user.version, name: user.name, email: user.email, active: user.active, roles: user.roles }} isSelf={isSelf}
      canEditProfile={hasPermission(actor, "users:update")} canAssignRoles={hasPermission(actor, "users:assign-roles")} canToggleActive={hasPermission(actor, "users:deactivate")}/>
    <section className="rounded-xl border border-[#ded5cd] bg-white p-5"><h3 className="flex items-center gap-2 font-semibold"><History size={17}/> Histórico de acesso</h3>
      {user.audit.length === 0 ? <p className="mt-3 text-sm text-[#746c67]">Nenhum evento registrado.</p> : <ol className="mt-4 space-y-3">{user.audit.map((entry) => <li key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-[#f1ebe6] pb-3 text-sm last:border-0"><span><span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>{describe(entry.metadata) && <span className="text-[#746c67]"> — {describe(entry.metadata)}</span>}</span><span className="text-xs text-[#817872]">{date(entry.createdAt)} · {entry.actorName ?? "Sistema / próprio usuário"}</span></li>)}</ol>}
    </section>
  </div>;
}
