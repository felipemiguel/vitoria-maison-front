import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requirePageUser } from "@/features/access/server";
import { navigationFor } from "@/features/access/navigation";
import { ROLE_LABELS } from "@/features/access/permissions";

export const dynamic = "force-dynamic";

/** Exige sessão válida de usuário ativo. Cada página e cada action validam sua própria permissão. */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <div className="min-h-screen bg-[#f4f0ec] text-[#302724]"><AdminSidebar items={navigationFor(user)}/><div className="lg:pl-72"><AdminHeader title="Painel administrativo" userName={user.name} roleLabels={user.roles.map((role)=>ROLE_LABELS[role])}/><main className="p-5 lg:p-8">{children}</main></div></div>;
}
