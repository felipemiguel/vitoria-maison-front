import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDatabase } from "@/database/client";
import { AuthenticationRequiredError, ForbiddenError } from "./errors";
import { hasAllPermissions, hasAnyPermission, type Permission } from "./permissions";
import { loadSessionUser, type SessionUser } from "./session-user";

/** Usuário autenticado e ativo da requisição atual (deduplicado por requisição). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return loadSessionUser(getDatabase(), id, session.sessionVersion);
});

/** Para Server Actions e serviços: lança erro em vez de redirecionar (não depende de try/catch). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  return requireAllPermissions([permission]);
}

export async function requireAllPermissions(permissions: readonly Permission[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasAllPermissions(user, permissions)) throw new ForbiddenError(permissions);
  return user;
}

export async function requireAnyPermission(permissions: readonly Permission[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasAnyPermission(user, permissions)) throw new ForbiddenError(permissions);
  return user;
}

/** Para páginas: sem sessão → login; sem permissão → página de acesso negado. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requirePagePermission(...permissions: Permission[]): Promise<SessionUser> {
  const user = await requirePageUser();
  if (!hasAllPermissions(user, permissions)) redirect("/admin/acesso-negado");
  return user;
}
