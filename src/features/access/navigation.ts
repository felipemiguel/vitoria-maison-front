import { hasPermission, type AccessSubject, type Permission } from "./permissions";

export type AdminNavIcon = "dashboard" | "properties" | "vista" | "import" | "highlights" | "collections" | "leads" | "users" | "brokerSites" | "mySite" | "account";
export type AdminNavItem = { href: string; label: string; icon: AdminNavIcon; permission: Permission };

/** Itens do menu e a permissão exigida por cada um. O servidor filtra antes de enviar ao cliente. */
export const ADMIN_NAVIGATION: AdminNavItem[] = [
  { href: "/admin", label: "Visão geral", icon: "dashboard", permission: "properties:read" },
  { href: "/admin/imoveis", label: "Imóveis", icon: "properties", permission: "properties:read" },
  { href: "/admin/vista", label: "Explorar Vista", icon: "vista", permission: "properties:read" },
  { href: "/admin/imoveis/novo", label: "Importar por código", icon: "import", permission: "properties:import" },
  { href: "/admin/destaques", label: "Destaques", icon: "highlights", permission: "properties:edit" },
  { href: "/admin/colecoes", label: "Coleções", icon: "collections", permission: "collections:manage" },
  { href: "/admin/leads", label: "Leads", icon: "leads", permission: "leads:read" },
  { href: "/admin/usuarios", label: "Usuários", icon: "users", permission: "users:read" },
  { href: "/admin/sites-corretores", label: "Sites de corretores", icon: "brokerSites", permission: "broker-site:manage-all" },
  { href: "/admin/meu-site", label: "Meu site", icon: "mySite", permission: "broker-site:read-own" },
  // Leads do próprio site (escopo resolvido na página pela sessão).
  { href: "/admin/meu-site/leads", label: "Meus leads", icon: "leads", permission: "leads:read-own" },
  { href: "/admin/minha-conta", label: "Minha conta", icon: "account", permission: "account:manage-own" },
];

export function navigationFor(subject: AccessSubject): Omit<AdminNavItem, "permission">[] {
  return ADMIN_NAVIGATION.filter((item) => hasPermission(subject, item.permission)).map(({ href, label, icon }) => ({ href, label, icon }));
}

/** Página inicial após o login: operação para quem pode operar; área pessoal para os demais. */
export function homePathFor(subject: AccessSubject): string {
  return hasPermission(subject, "properties:read") ? "/admin" : "/admin/minha-conta";
}
