import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { hasPermission } from "@/features/access/permissions";
import { UserForm } from "@/components/admin/users/user-form";

export const metadata = { title: "Novo usuário" };

export default async function NewUserPage() {
  const actor = await requirePagePermission("users:create");
  return <div className="mx-auto max-w-4xl space-y-6"><Link href="/admin/usuarios" className="inline-flex items-center gap-2 text-sm text-[#746c67]"><ArrowLeft size={16}/> Usuários</Link>
    <div><h2 className="text-2xl font-semibold">Novo usuário</h2><p className="mt-1 text-sm text-[#746c67]">A pessoa recebe um convite por e-mail e define a própria senha. Administradores não cadastram nem visualizam senhas.</p></div>
    <UserForm mode="create" canEditProfile canAssignRoles={hasPermission(actor, "users:assign-roles")} canToggleActive={hasPermission(actor, "users:deactivate")}/>
  </div>;
}
