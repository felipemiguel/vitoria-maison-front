import { describe, expect, it } from "vitest";
import { PERMISSIONS, effectivePermissions, hasAllPermissions, hasAnyPermission, hasPermission } from "./permissions";
import { homePathFor, navigationFor } from "./navigation";

const user = (...roles: string[]) => ({ active: true, roles });

describe("matriz de permissões", () => {
  it("ADMIN acessa gestão de usuários e operação, mas não recebe site de corretor automaticamente", () => {
    const admin = user("ADMIN");
    for (const permission of ["users:read", "users:create", "users:update", "users:deactivate", "users:assign-roles", "properties:import", "leads:manage"] as const) expect(hasPermission(admin, permission)).toBe(true);
    expect(hasPermission(admin, "broker-site:manage-all")).toBe(true);
    for (const own of ["broker-profile:read-own", "broker-site:create-own", "broker-site:update-own", "broker-site:submit-review"] as const) expect(hasPermission(admin, own)).toBe(false);
  });

  it("MANAGER sem BROKER não acessa sites de corretores", () => {
    for (const permission of ["broker-site:read-own", "broker-site:create-own", "broker-site:manage-all", "broker-profile:read-own"] as const) expect(hasPermission(user("MANAGER"), permission)).toBe(false);
  });

  it("MANAGER opera imóveis, coleções e leads, mas não acessa gestão de usuários", () => {
    const manager = user("MANAGER");
    for (const permission of ["properties:read", "properties:import", "properties:edit", "properties:publish", "properties:sync", "collections:manage", "leads:read", "leads:manage"] as const) expect(hasPermission(manager, permission)).toBe(true);
    for (const permission of ["users:read", "users:create", "users:update", "users:deactivate", "users:assign-roles"] as const) expect(hasPermission(manager, permission)).toBe(false);
  });

  it("BROKER só gerencia a própria conta: não importa imóveis nem vê leads gerais", () => {
    const broker = user("BROKER");
    expect([...effectivePermissions(broker)].sort()).toEqual(["account:manage-own", "broker-profile:read-own", "broker-profile:update-own", "broker-site:create-own", "broker-site:read-own", "broker-site:submit-review", "broker-site:update-own", "leads:read-own"]);
    expect(hasPermission(broker, "leads:manage")).toBe(false);
    expect(hasPermission(broker, "broker-site:manage-all")).toBe(false);
    expect(hasPermission(broker, "properties:import")).toBe(false);
    expect(hasPermission(broker, "leads:read")).toBe(false);
    expect(hasPermission(broker, "collections:manage")).toBe(false);
  });

  it("MANAGER + BROKER combina permissões (união), sem precisar de duas contas", () => {
    const both = user("MANAGER", "BROKER");
    expect(hasPermission(both, "properties:import")).toBe(true);
    expect(hasPermission(both, "account:manage-own")).toBe(true);
    expect(hasPermission(both, "users:read")).toBe(false);
    expect(hasPermission(both, "broker-site:update-own")).toBe(true);
    expect(hasPermission(both, "broker-site:manage-all")).toBe(false);
  });

  it("nega por padrão: sem perfil, perfil desconhecido ou usuário inativo", () => {
    expect(effectivePermissions(user()).size).toBe(0);
    expect(effectivePermissions(user("SUPERUSER", "admin")).size).toBe(0);
    expect(effectivePermissions({ active: false, roles: ["ADMIN"] }).size).toBe(0);
    expect(effectivePermissions(null).size).toBe(0);
    expect(hasAllPermissions(user("ADMIN"), [])).toBe(false);
  });

  it("any/all", () => {
    expect(hasAnyPermission(user("BROKER"), ["users:read", "account:manage-own"])).toBe(true);
    expect(hasAllPermissions(user("MANAGER"), ["properties:edit", "users:read"])).toBe(false);
  });

  it("toda permissão declarada pertence ao vocabulário", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });
});

describe("navegação por permissões", () => {
  const hrefs = (...roles: string[]) => navigationFor(user(...roles)).map((item) => item.href);
  it("ADMIN vê Usuários; MANAGER não; BROKER só a área pessoal", () => {
    expect(hrefs("ADMIN")).toContain("/admin/usuarios");
    expect(hrefs("MANAGER")).not.toContain("/admin/usuarios");
    expect(hrefs("MANAGER")).toContain("/admin/leads");
    expect(hrefs("BROKER")).toEqual(["/admin/meu-site", "/admin/meu-site/leads", "/admin/minha-conta"]);
    expect(hrefs("MANAGER")).not.toContain("/admin/meu-site/leads");
    expect(hrefs("ADMIN")).toContain("/admin/sites-corretores");
    expect(hrefs("ADMIN")).not.toContain("/admin/meu-site");
    expect(hrefs("MANAGER")).not.toContain("/admin/sites-corretores");
  });
  it("MANAGER + BROKER vê operação e área pessoal", () => {
    expect(hrefs("MANAGER", "BROKER")).toEqual(expect.arrayContaining(["/admin", "/admin/imoveis", "/admin/minha-conta"]));
  });
  it("página inicial depende das permissões", () => {
    expect(homePathFor(user("BROKER"))).toBe("/admin/minha-conta");
    expect(homePathFor(user("MANAGER"))).toBe("/admin");
  });
  it("itens enviados ao cliente não carregam a regra de permissão", () => {
    expect(navigationFor(user("ADMIN"))[0]).not.toHaveProperty("permission");
  });
});
