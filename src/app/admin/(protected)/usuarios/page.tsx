import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { requirePagePermission } from "@/features/access/server";
import { hasPermission, ROLE_CODES, ROLE_LABELS } from "@/features/access/permissions";
import { createUserManagementService } from "@/features/users/factory";
import { UserStatusBadge } from "@/components/admin/users/user-status-badge";
import { EmptyState } from "@/components/admin/empty-state";

export const metadata = { title: "Usuários" };
type Search = Record<string, string | undefined>;

const SORT_LABELS = { name: "Nome", email: "E-mail", created: "Criação", lastLogin: "Último acesso" } as const;
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value) : "—";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requirePagePermission("users:read");
  const query = await searchParams;
  const data = await createUserManagementService().list(actor, { search: query.busca, role: query.perfil, status: query.status, sort: query.ordem, direction: query.direcao, page: query.pagina, pageSize: query.itens });
  const { filters } = data;
  const link = (changes: Search) => {
    const params = new URLSearchParams(Object.entries({ busca: filters.search, perfil: filters.role, status: filters.status, ordem: filters.sort, direcao: filters.direction, itens: String(filters.pageSize), ...changes }).filter((entry): entry is [string, string] => Boolean(entry[1])));
    return `/admin/usuarios?${params}`;
  };
  const control = "w-full min-w-0 rounded-lg border border-[#d8ccc3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#66142e]";
  return <div className="mx-auto max-w-[1400px] space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">Usuários</h2><p className="mt-1 text-sm text-[#746c67]">Gerencie acessos, perfis e convites do painel.</p></div>
      {hasPermission(actor, "users:create") && <Link href="/admin/usuarios/novo" className="inline-flex items-center gap-2 rounded-lg bg-[#66142e] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17}/> Novo usuário</Link>}</div>
    <form className="grid gap-3 rounded-xl border border-[#ded5cd] bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
      <label className="relative"><span className="sr-only">Buscar por nome ou e-mail</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8f88]" size={16}/><input name="busca" defaultValue={filters.search} placeholder="Buscar por nome ou e-mail" className={`${control} w-full pl-9`}/></label>
      <select name="perfil" defaultValue={filters.role ?? ""} aria-label="Perfil" className={control}><option value="">Todos os perfis</option>{ROLE_CODES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>
      <select name="status" defaultValue={filters.status ?? ""} aria-label="Status" className={control}><option value="">Todos os status</option><option value="active">Ativos</option><option value="invited">Convite pendente</option><option value="inactive">Inativos</option></select>
      <select name="ordem" defaultValue={filters.sort} aria-label="Ordenar por" className={control}>{Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>Ordenar: {label}</option>)}</select>
      <button className="rounded-lg bg-[#302724] px-4 py-2.5 text-sm font-semibold text-white">Filtrar</button>
    </form>
    {data.items.length === 0 ? <EmptyState title="Nenhum usuário encontrado" description="Ajuste a busca ou os filtros."/> : <>
    {/* Mobile: cards com a ação sempre visível; tabela a partir de 768px. */}
    <div className="space-y-3 md:hidden">{data.items.map((user) => <Link key={user.id} href={`/admin/usuarios/${user.id}`} className="block rounded-xl border border-[#ded5cd] bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{user.name}{user.id === actor.id && <span className="ml-2 text-xs font-normal text-[#9b6a2f]">(você)</span>}</p><p className="mt-1 truncate text-xs text-[#746c67]">{user.email}</p></div><UserStatusBadge status={user.status}/></div><div className="mt-3 flex flex-wrap gap-1">{user.roles.length ? user.roles.map((role) => <span key={role} className="rounded-full bg-[#f4ece6] px-2 py-0.5 text-xs text-[#66142e]">{ROLE_LABELS[role]}</span>) : <span className="text-xs text-[#9a8f88]">Sem perfil</span>}</div><p className="mt-3 text-xs text-[#817872]">Último acesso: {date(user.lastLoginAt)}</p><p className="mt-3 border-t border-[#eee7e1] pt-3 text-sm font-semibold text-[#66142e]">Gerenciar →</p></Link>)}</div>
    <div className="hidden overflow-x-auto rounded-xl border border-[#ded5cd] bg-white md:block">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-[#ece4dd] bg-[#faf7f4] text-xs uppercase tracking-[.08em] text-[#817872]"><tr>
          {(["name", "email"] as const).map((key) => <th key={key} className="px-4 py-3"><Link href={link({ ordem: key, direcao: filters.sort === key && filters.direction === "asc" ? "desc" : "asc", pagina: undefined })}>{SORT_LABELS[key]}{filters.sort === key ? (filters.direction === "asc" ? " ↑" : " ↓") : ""}</Link></th>)}
          <th className="px-4 py-3">Perfis</th><th className="px-4 py-3">Status</th>
          {(["created", "lastLogin"] as const).map((key) => <th key={key} className="px-4 py-3"><Link href={link({ ordem: key, direcao: filters.sort === key && filters.direction === "desc" ? "asc" : "desc", pagina: undefined })}>{SORT_LABELS[key]}{filters.sort === key ? (filters.direction === "asc" ? " ↑" : " ↓") : ""}</Link></th>)}
          <th className="sticky right-0 bg-[#faf7f4] px-4 py-3"><span className="sr-only">Ações</span></th>
        </tr></thead>
        <tbody>{data.items.map((user) => <tr key={user.id} className="border-b border-[#f1ebe6] last:border-0">
          <td className="px-4 py-3 font-medium">{user.name}{user.id === actor.id && <span className="ml-2 text-xs font-normal text-[#9b6a2f]">(você)</span>}</td>
          <td className="px-4 py-3 text-[#5f5652]">{user.email}</td>
          <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{user.roles.length ? user.roles.map((role) => <span key={role} className="rounded-full bg-[#f4ece6] px-2 py-0.5 text-xs text-[#66142e]">{ROLE_LABELS[role]}</span>) : <span className="text-xs text-[#9a8f88]">Sem perfil</span>}</div></td>
          <td className="px-4 py-3"><UserStatusBadge status={user.status}/></td>
          <td className="px-4 py-3 text-[#5f5652]">{date(user.createdAt)}</td>
          <td className="px-4 py-3 text-[#5f5652]">{date(user.lastLoginAt)}</td>
          <td className="sticky right-0 bg-white px-4 py-3 text-right"><Link href={`/admin/usuarios/${user.id}`} className="text-sm font-semibold text-[#66142e]">Gerenciar</Link></td>
        </tr>)}</tbody>
      </table>
    </div></>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#746c67]"><span className="inline-flex items-center gap-2"><Users size={15}/> {data.total} usuário(s)</span>
      {data.pages > 1 && <nav aria-label="Paginação" className="flex gap-2">{filters.page > 1 && <Link href={link({ pagina: String(filters.page - 1) })} className="rounded-lg border border-[#d8ccc3] bg-white px-3 py-2">Anterior</Link>}<span className="px-2 py-2">Página {filters.page} de {data.pages}</span>{filters.page < data.pages && <Link href={link({ pagina: String(filters.page + 1) })} className="rounded-lg border border-[#d8ccc3] bg-white px-3 py-2">Próxima</Link>}</nav>}</div>
  </div>;
}
