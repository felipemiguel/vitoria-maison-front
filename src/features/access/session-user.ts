import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminUsers, roles, userRoles } from "@/database/schema";
import { effectivePermissions, isRoleCode, type Permission, type RoleCode } from "./permissions";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  active: true;
  roles: RoleCode[];
  permissions: Permission[];
  sessionVersion: number;
};

/**
 * Carrega o usuário da sessão diretamente do PostgreSQL a cada requisição.
 * Perfis e status nunca vêm do cookie: alterações passam a valer na requisição seguinte.
 * Retorna null para usuário inexistente, inativo ou com sessão revogada (session_version diferente).
 */
export async function loadSessionUser(db: NodePgDatabase<typeof schema>, userId: string, tokenSessionVersion: number | undefined): Promise<SessionUser | null> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const rows = await db.select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, active: adminUsers.active, sessionVersion: adminUsers.sessionVersion, role: roles.code })
    .from(adminUsers)
    .leftJoin(userRoles, eq(userRoles.userId, adminUsers.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(adminUsers.id, userId));
  const user = rows[0];
  if (!user || !user.active) return null;
  // Sessões emitidas antes da Fase 6 não têm versão: equivalem à versão 0 (padrão da migration).
  if (user.sessionVersion !== (tokenSessionVersion ?? 0)) return null;
  const userRoleCodes = [...new Set(rows.map((row) => row.role).filter(isRoleCode))].sort();
  return {
    id: user.id, name: user.name, email: user.email, active: true,
    roles: userRoleCodes,
    permissions: [...effectivePermissions({ active: true, roles: userRoleCodes })].sort(),
    sessionVersion: user.sessionVersion,
  };
}
