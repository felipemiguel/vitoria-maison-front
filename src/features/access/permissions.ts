/**
 * Matriz central de perfis e permissões (RBAC). Fonte única de verdade, em código.
 *
 * - As permissões efetivas são a UNIÃO das permissões dos perfis do usuário.
 * - Negação por padrão: perfil desconhecido ou usuário inativo não recebe nenhuma permissão.
 * - Não há hierarquia entre perfis; ADMIN recebe todas as permissões explicitamente,
 *   exceto as que dependem de propriedade do recurso (`broker-*:*-own`), que vêm do perfil BROKER.
 */

export const ROLE_CODES = ["ADMIN", "MANAGER", "BROKER"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSIONS = [
  "users:read", "users:create", "users:update", "users:deactivate", "users:assign-roles",
  "properties:read", "properties:import", "properties:edit", "properties:publish", "properties:sync",
  "collections:manage",
  "leads:read", "leads:manage",
  "account:manage-own",
  // Sites de corretores: as permissões "-own" exigem também ser dono do recurso (validado no servidor).
  "broker-profile:read-own", "broker-profile:update-own",
  "broker-site:read-own", "broker-site:create-own", "broker-site:update-own", "broker-site:submit-review",
  "broker-site:manage-all",
  // Leads do próprio site (escopo resolvido da sessão: site E usuário).
  "leads:read-own",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const OPERATIONS: Permission[] = [
  "properties:read", "properties:import", "properties:edit", "properties:publish", "properties:sync",
  "collections:manage", "leads:read", "leads:manage",
];
const USER_MANAGEMENT: Permission[] = ["users:read", "users:create", "users:update", "users:deactivate", "users:assign-roles"];

const BROKER_OWN: Permission[] = [
  "broker-profile:read-own", "broker-profile:update-own",
  "broker-site:read-own", "broker-site:create-own", "broker-site:update-own", "broker-site:submit-review",
  "leads:read-own",
];

export const ROLE_PERMISSIONS: Record<RoleCode, readonly Permission[]> = {
  // ADMIN gerencia todos os sites, mas não recebe identidade de corretor: as permissões "-own" vêm só do BROKER.
  ADMIN: [...USER_MANAGEMENT, ...OPERATIONS, "account:manage-own", "broker-site:manage-all"],
  // MANAGER não tem acesso automático aos sites pessoais dos corretores.
  MANAGER: [...OPERATIONS, "account:manage-own"],
  BROKER: ["account:manage-own", ...BROKER_OWN],
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
