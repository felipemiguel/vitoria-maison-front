import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/database/schema";
import { adminUsers, roles, userAuditEvents, userRoles, userTokens } from "@/database/schema";
import { loadSessionUser } from "@/features/access/session-user";
import { hasPermission, type RoleCode } from "@/features/access/permissions";
import { ForbiddenError } from "@/features/access/errors";
import type { EmailMessage, EmailProvider } from "@/features/email/provider";
import { UserManagementService } from "./user-management-service";
import { AccountService } from "./account-service";
import { RateLimiter, RateLimitError } from "./rate-limit";
import { InvalidTokenError, LastAdminError, UserManagementError, isLastAdminDatabaseError } from "./errors";
import { DrizzleAdminAuthStore } from "@/features/admin/auth/drizzle-admin-auth-store";
import { hashToken } from "./tokens";

/**
 * Integração com PostgreSQL real. Executa somente com TEST_DATABASE_URL apontando para um banco
 * de TESTE já migrado — usuários @teste.local e tokens/auditoria são apagados. Nunca aponte para produção.
 */
const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

class CapturingEmail implements EmailProvider {
  readonly name = "capture";
  sent: EmailMessage[] = [];
  async send(message: EmailMessage) { this.sent.push(message); return { delivered: true, provider: this.name }; }
  lastToken(): string { const match = /token=([A-Za-z0-9_-]{43})/.exec(this.sent.at(-1)?.text ?? ""); if (!match) throw new Error("sem token"); return match[1]; }
}

integration("gestão de usuários e RBAC (PostgreSQL)", () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 6 });
  const db = drizzle(pool, { schema });
  let email: CapturingEmail;
  let clock: Date;
  let users: UserManagementService;
  let accounts: AccountService;
  const fastHash = async (password: string) => `hash:${password}`;
  const fastVerify = async (hash: string, password: string) => hash === `hash:${password}`;

  afterAll(async () => pool.end());

  beforeEach(async () => {
    // Limpeza restrita aos dados deste arquivo (e-mails @teste.local). TRUNCATE nas tabelas de acesso
    // contorna os triggers de linha (auditoria imutável, último ADMIN); outros arquivos de integração não usam perfis.
    // TRUNCATE (e não DELETE) porque o trigger do último ADMIN barraria a remoção dos perfis.
    await db.execute(sql`truncate table user_tokens, user_audit_events, user_roles`);
    await db.execute(sql`delete from admin_users where email like '%@teste.local'`);
    await db.execute(sql`delete from admin_login_attempts`);
    email = new CapturingEmail();
    clock = new Date("2026-11-10T12:00:00Z");
    users = new UserManagementService(db, email, () => "https://painel.vitoria.test", () => clock);
    accounts = new AccountService(db, { email, rateLimiter: new RateLimiter(new DrizzleAdminAuthStore(db), "segredo-de-teste"), hashPassword: fastHash, verifyPassword: fastVerify, appOrigin: () => "https://painel.vitoria.test", now: () => clock });
  });

  async function seed(name: string, rolesList: RoleCode[], active = true, password: string | null = "senha-antiga-123") {
    const user = (await db.insert(adminUsers).values({ name, email: `${name.toLowerCase().replace(/\W+/g, ".")}@teste.local`, passwordHash: password ? await fastHash(password) : null, active }).returning())[0];
    for (const code of rolesList) {
      const role = (await db.select().from(roles).where(eq(roles.code, code)))[0];
      await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
    }
    return user;
  }
  const actor = async (id: string) => (await loadSessionUser(db, id, (await db.select().from(adminUsers).where(eq(adminUsers.id, id)))[0].sessionVersion))!;
  /** Leitor fixo com users:read, só para inspecionar o estado nos testes (não altera dados). */
  const reader = { id: "00000000-0000-4000-8000-00000000beef", active: true as const, roles: ["ADMIN" as const] };
  const current = async (id: string) => (await users.get(reader, id))!;

  describe("usuários", () => {
    it("cria conta sem senha, com múltiplos perfis, convite e auditoria", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      const created = await users.create(await actor(admin.id), { name: "Gestora Corretora", email: "Gestora@Teste.Local", roles: ["MANAGER", "BROKER"], active: true });
      expect(created.invitation).toEqual({ delivered: true, provider: "capture" });
      const row = (await db.select().from(adminUsers).where(eq(adminUsers.id, created.id)))[0];
      expect(row).toMatchObject({ email: "gestora@teste.local", passwordHash: null, active: true });
      expect((await users.get(await actor(admin.id), created.id))!.roles).toEqual(["BROKER", "MANAGER"]);
      expect(email.sent[0].text).toContain("https://painel.vitoria.test/admin/convite?token=");
      const tokens = await db.select().from(userTokens).where(eq(userTokens.userId, created.id));
      expect(tokens[0].tokenHash).toBe(hashToken(email.lastToken()));
      const audit = (await db.select().from(userAuditEvents).where(eq(userAuditEvents.targetUserId, created.id))).map((event) => event.action);
      expect(audit).toEqual(expect.arrayContaining(["USER_CREATED", "INVITE_SENT"]));
      expect(JSON.stringify(await db.select().from(userAuditEvents))).not.toContain(email.lastToken());
    });

    it("rejeita e-mail duplicado (sem diferenciar maiúsculas)", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      await expect(users.create(await actor(admin.id), { name: "Outro", email: "ADMIN@teste.local", roles: ["BROKER"], active: true })).rejects.toThrow("Já existe um usuário com este e-mail.");
    });

    it("exige perfil para ativar o acesso e valida perfis existentes", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      await expect(users.create(await actor(admin.id), { name: "Sem Perfil", email: "sem@teste.local", roles: [], active: true })).rejects.toThrow(/ao menos um perfil/);
      await expect(users.create(await actor(admin.id), { name: "Inválido", email: "x@teste.local", roles: ["SUPERUSER"], active: true })).rejects.toThrow();
    });

    it("MANAGER não cria nem lista usuários (autorização no serviço)", async () => {
      const manager = await seed("Gestor", ["MANAGER"]);
      await expect(users.create(await actor(manager.id), { name: "X", email: "x@teste.local", roles: ["BROKER"], active: true })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(users.list(await actor(manager.id), {})).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("lista com busca, filtro por perfil e status e paginação no servidor", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      for (let i = 0; i < 25; i += 1) await seed(`Corretor ${String(i).padStart(2, "0")}`, ["BROKER"], i % 3 !== 0);
      const page = await users.list(await actor(admin.id), { role: "BROKER", status: "active", pageSize: 10, page: 2, sort: "name" });
      expect(page.total).toBe(16);
      expect(page.items).toHaveLength(6);
      expect(page.pages).toBe(2);
      expect(page.items.every((item) => item.roles.includes("BROKER") && item.status === "active")).toBe(true);
      expect((await users.list(await actor(admin.id), { search: "corretor 0" })).total).toBe(10);
      expect((await users.list(await actor(admin.id), { status: "inactive" })).total).toBe(9);
      expect((await users.list(await actor(admin.id), { search: "100%_" })).total).toBe(0);
    });

    it("desativa e reativa, adiciona e remove perfis, com auditoria", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      const target = await seed("Pessoa", ["BROKER"]);
      let details = await current(target.id);
      await users.update(await actor(admin.id), { id: target.id, version: details.version, name: "Pessoa", email: details.email, roles: ["BROKER", "MANAGER"], active: false });
      details = await current(target.id);
      expect(details).toMatchObject({ active: false, roles: ["BROKER", "MANAGER"] });
      await users.update(await actor(admin.id), { id: target.id, version: details.version, name: "Pessoa", email: details.email, roles: ["MANAGER"], active: true });
      details = await current(target.id);
      expect(details).toMatchObject({ active: true, roles: ["MANAGER"] });
      expect(details.audit.map((event) => event.action)).toEqual(expect.arrayContaining(["USER_DEACTIVATED", "USER_ACTIVATED", "ROLE_ADDED", "ROLE_REMOVED"]));
    });

    it("controle otimista de versão", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      const target = await seed("Pessoa", ["BROKER"]);
      await expect(users.update(await actor(admin.id), { id: target.id, version: 99, name: "Xavier", email: target.email, roles: ["BROKER"], active: true })).rejects.toThrow(/alterado por outra pessoa/);
    });

    it("usuário não desativa a si mesmo nem remove o próprio ADMIN", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      await seed("Admin Dois", ["ADMIN"]);
      const details = await current(admin.id);
      await expect(users.update(await actor(admin.id), { id: admin.id, version: details.version, name: admin.name, email: admin.email, roles: ["ADMIN"], active: false })).rejects.toThrow(/próprio acesso/);
      await expect(users.update(await actor(admin.id), { id: admin.id, version: details.version, name: admin.name, email: admin.email, roles: ["MANAGER"], active: true })).rejects.toThrow(/próprio perfil de administrador/);
    });
  });

  describe("sessão e revogação", () => {
    it("usuário inativo perde acesso imediatamente", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      const target = await seed("Pessoa", ["MANAGER"]);
      expect(await loadSessionUser(db, target.id, 0)).not.toBeNull();
      const details = await current(target.id);
      await users.update(await actor(admin.id), { id: target.id, version: details.version, name: target.name, email: target.email, roles: ["MANAGER"], active: false });
      expect(await loadSessionUser(db, target.id, 0)).toBeNull();
      expect(await loadSessionUser(db, target.id, 1)).toBeNull();
    });

    it("mudança de perfil revoga o acesso existente sem esperar o token expirar", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      const target = await seed("Pessoa", ["MANAGER", "BROKER"]);
      const before = await loadSessionUser(db, target.id, 0);
      expect(hasPermission(before, "properties:import")).toBe(true);
      const details = await current(target.id);
      await users.update(await actor(admin.id), { id: target.id, version: details.version, name: target.name, email: target.email, roles: ["BROKER"], active: true });
      const after = await loadSessionUser(db, target.id, 0);
      expect(hasPermission(after, "properties:import")).toBe(false);
      expect(hasPermission(after, "account:manage-own")).toBe(true);
    });

    it("sessão com versão antiga é inválida após troca de e-mail; sessões antigas sem versão valem como 0", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      const target = await seed("Pessoa", ["BROKER"]);
      expect(await loadSessionUser(db, target.id, undefined)).not.toBeNull();
      const details = await current(target.id);
      await users.update(await actor(admin.id), { id: target.id, version: details.version, name: target.name, email: "novo@teste.local", roles: ["BROKER"], active: true });
      expect(await loadSessionUser(db, target.id, 0)).toBeNull();
      expect(await loadSessionUser(db, target.id, 1)).not.toBeNull();
      expect(await loadSessionUser(db, "00000000-0000-4000-8000-000000000000", 0)).toBeNull();
      expect(await loadSessionUser(db, "não-é-uuid", 0)).toBeNull();
    });
  });

  describe("último administrador", () => {
    it("não pode ser desativado nem perder o perfil ADMIN", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      const other = await seed("Outro Admin", ["ADMIN"]);
      const details = await current(admin.id);
      await users.update(await actor(other.id), { id: admin.id, version: details.version, name: admin.name, email: admin.email, roles: ["ADMIN"], active: false });
      const otherDetails = await current(other.id);
      // "other" é agora o único ADMIN ativo; um gestor-admin inexistente não pode removê-lo: usamos o próprio serviço via outro admin reativado.
      await db.update(adminUsers).set({ active: true }).where(eq(adminUsers.id, admin.id));
      await db.delete(userRoles).where(eq(userRoles.userId, admin.id));
      const manager = await seed("Gestor", ["MANAGER"]);
      await expect(users.update(await actor(other.id), { id: other.id, version: otherDetails.version, name: other.name, email: other.email, roles: ["ADMIN"], active: false })).rejects.toThrow(/próprio acesso/);
      // Remoção direta no banco é barrada pelo trigger.
      await expect(db.delete(userRoles).where(eq(userRoles.userId, other.id))).rejects.toSatisfy(isLastAdminDatabaseError);
      await expect(db.update(adminUsers).set({ active: false }).where(eq(adminUsers.id, other.id))).rejects.toSatisfy(isLastAdminDatabaseError);
      expect(manager).toBeTruthy();
    });

    it("o serviço converte a violação em erro seguro", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      const second = await seed("Segundo", ["ADMIN"]);
      // second remove ADMIN de admin (ok, sobra second). Depois admin (sem ADMIN) não pode mais gerir.
      const d1 = await current(admin.id);
      await users.update(await actor(second.id), { id: admin.id, version: d1.version, name: admin.name, email: admin.email, roles: ["MANAGER"], active: true });
      await expect(users.list(await actor(admin.id), {})).rejects.toBeInstanceOf(ForbiddenError);
      // Restaurar um terceiro admin só para tentar remover o último via serviço por outro ADMIN.
      const third = await seed("Terceiro", ["ADMIN"]);
      await db.update(adminUsers).set({ active: false }).where(eq(adminUsers.id, third.id));
      const d2 = await current(second.id);
      const thirdActor = { id: third.id, active: true as const, roles: ["ADMIN" as const] };
      await expect(users.update(thirdActor, { id: second.id, version: d2.version, name: second.name, email: second.email, roles: ["MANAGER"], active: true })).rejects.toBeInstanceOf(LastAdminError);
    });

    it("alterações concorrentes não deixam o sistema sem ADMIN ativo (serviço)", async () => {
      const a = await seed("Admin A", ["ADMIN"]);
      const b = await seed("Admin B", ["ADMIN"]);
      const operator = { id: (await seed("Operador", ["MANAGER"])).id, active: true as const, roles: ["ADMIN" as const] };
      const [da, dbb] = [await current(a.id), await current(b.id)];
      const results = await Promise.allSettled([
        users.update(operator, { id: a.id, version: da.version, name: a.name, email: a.email, roles: ["ADMIN"], active: false }),
        users.update(operator, { id: b.id, version: dbb.version, name: b.name, email: b.email, roles: ["ADMIN"], active: false }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: expect.any(LastAdminError) });
      const active = await db.execute(sql`select count(*)::int as n from admin_users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.code='ADMIN' and u.active`);
      expect(active.rows[0]).toEqual({ n: 1 });
    });

    it("alterações concorrentes diretas no banco também são barradas pelo trigger", async () => {
      const a = await seed("Admin A", ["ADMIN"]);
      const b = await seed("Admin B", ["ADMIN"]);
      const c1 = await pool.connect(), c2 = await pool.connect();
      try {
        await c1.query("begin"); await c2.query("begin");
        await c1.query("update admin_users set active=false where id=$1", [a.id]);
        await c2.query("delete from user_roles where user_id=$1", [b.id]);
        const outcomes = await Promise.allSettled([c1.query("commit"), c2.query("commit")]);
        expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
      } finally { c1.release(); c2.release(); }
      const active = await db.execute(sql`select count(*)::int as n from admin_users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.code='ADMIN' and u.active`);
      expect(active.rows[0]).toEqual({ n: 1 });
    });
  });

  describe("convites", () => {
    async function invite() {
      const admin = await seed("Admin", ["ADMIN"]);
      const created = await users.create(await actor(admin.id), { name: "Convidada", email: "convidada@teste.local", roles: ["BROKER"], active: true });
      return { admin, id: created.id, token: email.lastToken() };
    }

    it("aceite define a senha, registra o aceite e consome o token (uso único)", async () => {
      const { id, token } = await invite();
      await accounts.acceptInvite({ token, password: "senha-nova-segura", confirmation: "senha-nova-segura" }, "10.0.0.1");
      const row = (await db.select().from(adminUsers).where(eq(adminUsers.id, id)))[0];
      expect(row.passwordHash).toBe("hash:senha-nova-segura");
      expect(row.invitationAcceptedAt).toEqual(clock);
      await expect(accounts.acceptInvite({ token, password: "outra-senha-segura", confirmation: "outra-senha-segura" }, "10.0.0.2")).rejects.toBeInstanceOf(InvalidTokenError);
    });

    it("token expirado é recusado com mensagem genérica", async () => {
      const { token } = await invite();
      clock = new Date(clock.getTime() + 73 * 60 * 60 * 1000);
      expect(await accounts.isTokenUsable("INVITE", token)).toBe(false);
      await expect(accounts.acceptInvite({ token, password: "senha-nova-segura", confirmation: "senha-nova-segura" }, "10.0.0.1")).rejects.toThrow("Este link é inválido ou expirou");
    });

    it("convite para conta desativada não pode ser usado", async () => {
      const { admin, id, token } = await invite();
      const details = await current(id);
      await users.update(await actor(admin.id), { id, version: details.version, name: details.name, email: details.email, roles: ["BROKER"], active: false });
      await expect(accounts.acceptInvite({ token, password: "senha-nova-segura", confirmation: "senha-nova-segura" }, "10.0.0.1")).rejects.toBeInstanceOf(InvalidTokenError);
    });

    it("novo convite invalida o anterior", async () => {
      const { admin, id, token } = await invite();
      await users.resendInvite(await actor(admin.id), id);
      const fresh = email.lastToken();
      expect(fresh).not.toBe(token);
      await expect(accounts.acceptInvite({ token, password: "senha-nova-segura", confirmation: "senha-nova-segura" }, "10.0.0.1")).rejects.toBeInstanceOf(InvalidTokenError);
      await expect(accounts.acceptInvite({ token: fresh, password: "senha-nova-segura", confirmation: "senha-nova-segura" }, "10.0.0.1")).resolves.toBeUndefined();
      await expect(users.resendInvite(await actor(admin.id), id)).rejects.toBeInstanceOf(UserManagementError);
    });

    it("aceite tem rate limiting por IP", async () => {
      await invite();
      for (let i = 0; i < 10; i += 1) await accounts.acceptInvite({ token: "x".repeat(43), password: "senha-nova-segura", confirmation: "senha-nova-segura" }, "10.9.9.9").catch(() => undefined);
      await expect(accounts.acceptInvite({ token: "x".repeat(43), password: "senha-nova-segura", confirmation: "senha-nova-segura" }, "10.9.9.9")).rejects.toBeInstanceOf(RateLimitError);
    });
  });

  describe("recuperação de senha", () => {
    it("envia link apenas para conta ativa com senha e não revela a existência da conta", async () => {
      const person = await seed("Pessoa", ["BROKER"]);
      await expect(accounts.requestPasswordReset("inexistente@teste.local", "10.0.0.1")).resolves.toBeUndefined();
      expect(email.sent).toHaveLength(0);
      await accounts.requestPasswordReset(person.email.toUpperCase(), "10.0.0.1");
      expect(email.sent).toHaveLength(1);
      expect(email.sent[0].text).toContain("https://painel.vitoria.test/admin/redefinir-senha?token=");
      expect(email.sent[0].text).not.toContain("senha-antiga-123");
    });

    it("redefinição troca a senha, revoga sessões e o token não pode ser reutilizado", async () => {
      const person = await seed("Pessoa", ["MANAGER"]);
      await accounts.requestPasswordReset(person.email, "10.0.0.1");
      const token = email.lastToken();
      await accounts.resetPassword({ token, password: "senha-redefinida-1", confirmation: "senha-redefinida-1" }, "10.0.0.1");
      const row = (await db.select().from(adminUsers).where(eq(adminUsers.id, person.id)))[0];
      expect(row.passwordHash).toBe("hash:senha-redefinida-1");
      expect(await loadSessionUser(db, person.id, 0)).toBeNull();
      await expect(accounts.resetPassword({ token, password: "senha-redefinida-2", confirmation: "senha-redefinida-2" }, "10.0.0.1")).rejects.toBeInstanceOf(InvalidTokenError);
    });

    it("solicitações têm rate limiting por e-mail", async () => {
      const person = await seed("Pessoa", ["BROKER"]);
      for (let i = 0; i < 3; i += 1) await accounts.requestPasswordReset(person.email, `10.0.0.${i}`);
      await expect(accounts.requestPasswordReset(person.email, "10.0.0.99")).rejects.toBeInstanceOf(RateLimitError);
    });

    it("troca da própria senha exige a senha atual e encerra as sessões", async () => {
      const person = await seed("Pessoa", ["BROKER"]);
      await expect(accounts.changeOwnPassword(person, { current: "errada", password: "senha-nova-segura", confirmation: "senha-nova-segura" })).rejects.toThrow("A senha atual não confere.");
      await accounts.changeOwnPassword(person, { current: "senha-antiga-123", password: "senha-nova-segura", confirmation: "senha-nova-segura" });
      expect(await loadSessionUser(db, person.id, 0)).toBeNull();
    });
  });

  describe("auditoria", () => {
    it("é somente inserção", async () => {
      const admin = await seed("Admin", ["ADMIN"]);
      await users.create(await actor(admin.id), { name: "Xavier", email: "x@teste.local", roles: ["BROKER"], active: false });
      const immutable = (error: unknown) => /somente inserção/.test(String((error as { cause?: { message?: string } }).cause?.message ?? error));
      await expect(db.update(userAuditEvents).set({ action: "ADULTERADO" })).rejects.toSatisfy(immutable);
      await expect(db.delete(userAuditEvents)).rejects.toSatisfy(immutable);
    });
  });
});
