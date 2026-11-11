import type { UserStatus } from "@/features/users/user-management-service";

const styles: Record<UserStatus, [string, string]> = {
  active: ["Ativo", "bg-emerald-50 text-emerald-800 ring-emerald-200"],
  invited: ["Convite pendente", "bg-amber-50 text-amber-800 ring-amber-200"],
  inactive: ["Inativo", "bg-[#f1ece8] text-[#6b625d] ring-[#ddd3cb]"],
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const [label, className] = styles[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${className}`}>{label}</span>;
}
