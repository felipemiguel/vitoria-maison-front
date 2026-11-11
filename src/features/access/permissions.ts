/**
 * Matriz central de perfis e permissões (RBAC). Fonte única de verdade, em código.
 *
 * - As permissões efetivas são a UNIÃO das permissões dos perfis do usuário.
 * - Negação por padrão: perfil desconhecido ou usuário inativo não recebe nenhuma permissão.
 * - Não há hierarquia entre perfis; ADMIN recebe todas as permissões explicitamente,
 *   exceto as que dependem de propriedade do recurso (`broker-site:manage-own`).
 */

export const ROLE_CODES = ["ADMIN", "MANAGER", "BROKER"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSIONS = [
  "users:read", "users:create", "users:update", "users:deactivate", "users:assign-roles",
  "properties:read", "properties:import", "properties:edit", "properties:publish", "properties:sync",
  "collections:manage",
  "leads:read", "leads:manage",
  "account:manage-own",
  "broker-site:manage-own",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const OPERATIONS: Permission[] = [
  "properties:read", "properties:import", "properties:edit", "properties:publish", "properties:sync",
  "collections:manage", "leads:read", "leads:manage",
];
const USER_MANAGEMENT: Permission[] = ["users:read", "users:create", "users:update", "users:deactivate", "users:assign-roles"];

export const ROLE_PERMISSIONS: Record<RoleCode, readonly Permission[]> = {
  ADMIN: [...USER_MANAGEMENT, ...OPERATIONS, "account:manage-own"],
  MANAGER: [...OPERATIONS, "account:manage-own"],
  // `broker-site:manage-own` fica reservado para a fase do site individual; ainda não é concedido.
  BROKER: ["account:manage-own"],
};

export const ROLE_LABELS: Record<RoleCode, string> = { ADMIN: "Administrador", MANAGER: "Gestor", BROKER: "Corretor" };

export function isRoleCode(value: unknown): value is RoleCode {
  return typeof value === "string" && (ROLE_CODES as readonly string[]).includes(value);
}

export type AccessSubject = { active: boolean; roles: readonly string[] };

export function effectivePermissions(subject: AccessSubject | null | undefined): ReadonlySet<Permission> {
  if (!subject?.active) return new Set();
  return new Set(subject.roles.filter(isRoleCode).flatMap((role) => ROLE_PERMISSIONS[role]));
}

export function hasPermission(subject: AccessSubject | null | undefined, permission: Permission): boolean {
  return effectivePermissions(subject).has(permission);
}

export function hasAnyPermission(subject: AccessSubject | null | undefined, permissions: readonly Permission[]): boolean {
  const granted = effectivePermissions(subject);
  return permissions.some((permission) => granted.has(permission));
}

export function hasAllPermissions(subject: AccessSubject | null | undefined, permissions: readonly Permission[]): boolean {
  const granted = effectivePermissions(subject);
  return permissions.length > 0 && permissions.every((permission) => granted.has(permission));
}
