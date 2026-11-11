import { and, asc, count, desc, eq, exists, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminUsers, roles, userAuditEvents, userRoles, userTokens } from "@/database/schema";
import { ForbiddenError } from "@/features/access/errors";
import { hasPermission, type Permission, type RoleCode } from "@/features/access/permissions";
import type { SessionUser } from "@/features/access/session-user";
import type { EmailProvider } from "@/features/email/provider";
import { invitationEmail } from "@/features/email/templates";
import { LastAdminError, UserConcurrencyError, UserManagementError, isLastAdminDatabaseError, isUniqueViolation } from "./errors";
import { TOKEN_TTL_MS, generateToken, hashToken } from "./tokens";
import { createUserSchema, sanitizeAuditMetadata, updateUserSchema, userListFiltersSchema } from "./validation";

type Db = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Actor = Pick<SessionUser, "id" | "active" | "roles">;

/** Mesma chave usada pelo trigger do banco: serializa todas as mudanças que afetam administradores. */
export const ACTIVE_ADMINS_LOCK = sql`select pg_advisory_xact_lock(hashtext('vitoria-maison:active-admins'))`;

export type UserStatus = "active" | "inactive" | "invited";
export type UserSummary = { id: string; name: string; email: string; active: boolean; status: UserStatus; roles: RoleCode[]; createdAt: Date; lastLoginAt: Date | null };
export type UserDetails = UserSummary & { version: number; invitedAt: Date | null; invitationAcceptedAt: Date | null; hasPassword: boolean; pendingInviteExpiresAt: Date | null; audit: AuditEntry[] };
export type AuditEntry = { id: string; action: string; actorName: string | null; metadata: Record<string, unknown>; createdAt: Date };
export type InvitationResult = { delivered: boolean; provider: string };

export function userStatus(user: { active: boolean; passwordHash: string | null }): UserStatus {
  if (!user.active) return "inactive";
  return user.passwordHash ? "active" : "invited";
}

export class UserManagementService {
  constructor(
    private readonly db: Db,
    private readonly email: EmailProvider,
    private readonly appOrigin: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(actor: Actor, input: unknown) {
    this.assert(actor, "users:read");
    const filters = userListFiltersSchema.parse(input ?? {});
    const conditions: SQL[] = [];
    if (filters.search) {
      const term = `%${filters.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      conditions.push(or(ilike(adminUsers.name, term), ilike(adminUsers.email, term))!);
    }
    if (filters.status === "active") conditions.push(eq(adminUsers.active, true), isNotNull(adminUsers.passwordHash));
    if (filters.status === "invited") conditions.push(eq(adminUsers.active, true), isNull(adminUsers.passwordHash));
    if (filters.status === "inactive") conditions.push(eq(adminUsers.active, false));
    if (filters.role) conditions.push(exists(this.db.select({ one: sql`1` }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(and(eq(userRoles.userId, adminUsers.id), eq(roles.code, filters.role)))));
    const column = { name: adminUsers.name, email: adminUsers.email, created: adminUsers.createdAt, lastLogin: adminUsers.lastLoginAt }[filters.sort];
    const order = filters.direction === "desc" ? sql`${column} desc nulls last` : sql`${column} asc nulls last`;
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totals] = await Promise.all([
      this.db.select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, active: adminUsers.active, passwordHash: adminUsers.passwordHash, createdAt: adminUsers.createdAt, lastLoginAt: adminUsers.lastLoginAt })
        .from(adminUsers).where(where).orderBy(order, asc(adminUsers.id)).limit(filters.pageSize).offset((filters.page - 1) * filters.pageSize),
      this.db.select({ total: count() }).from(adminUsers).where(where),
    ]);
    const roleMap = await this.rolesFor(rows.map((row) => row.id));
    const total = Number(totals[0]?.total ?? 0);
    return {
      filters,
      total,
      pages: Math.max(1, Math.ceil(total / filters.pageSize)),
      items: rows.map(({ passwordHash, ...row }): UserSummary => ({ ...row, status: userStatus({ active: row.active, passwordHash }), roles: roleMap.get(row.id) ?? [] })),
    };
  }

  async get(actor: Actor, id: string): Promise<UserDetails | null> {
    this.assert(actor, "users:read");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const user = (await this.db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1))[0];
    if (!user) return null;
    const [roleMap, audit, invite] = await Promise.all([
      this.rolesFor([id]),
      this.db.select({ id: userAuditEvents.id, action: userAuditEvents.action, actorName: adminUsers.name, metadata: userAuditEvents.metadata, createdAt: userAuditEvents.createdAt })
        .from(userAuditEvents).leftJoin(adminUsers, eq(adminUsers.id, userAuditEvents.actorUserId))
        .where(eq(userAuditEvents.targetUserId, id)).orderBy(desc(userAuditEvents.createdAt)).limit(50),
      this.db.select({ expiresAt: userTokens.expiresAt }).from(userTokens)
        .where(and(eq(userTokens.userId, id), eq(userTokens.purpose, "INVITE"), isNull(userTokens.usedAt), isNull(userTokens.revokedAt), sql`${userTokens.expiresAt} > ${this.now()}`))
        .orderBy(desc(userTokens.createdAt)).limit(1),
    ]);
    return {
      id: user.id, name: user.name, email: user.email, active: user.active, status: userStatus(user), roles: roleMap.get(id) ?? [],
      createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, version: user.version, invitedAt: user.invitedAt,
      invitationAcceptedAt: user.invitationAcceptedAt, hasPassword: Boolean(user.passwordHash),
      pendingInviteExpiresAt: invite[0]?.expiresAt ?? null,
      audit: audit.map((entry) => ({ ...entry, metadata: (entry.metadata ?? {}) as Record<string, unknown> })),
    };
  }

  /** Cria a conta sem senha. Se ativa, emite convite para que o próprio usuário defina a senha. */
  async create(actor: Actor, input: unknown): Promise<{ id: string; invitation: InvitationResult | null }> {
    this.assert(actor, "users:create");
    const data = createUserSchema.parse(input);
    if (data.roles.length) this.assert(actor, "users:assign-roles");
    if (data.active && data.roles.length === 0) throw new UserManagementError("Atribua ao menos um perfil para ativar o acesso.");
    const now = this.now();
    let token: string | null = null;
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        if (await this.emailInUse(tx, data.email)) throw new UserManagementError("Já existe um usuário com este e-mail.");
        const created = (await tx.insert(adminUsers).values({ name: data.name, email: data.email, active: data.active, passwordHash: null, invitedAt: data.active ? now : null, createdAt: now, updatedAt: now }).returning({ id: adminUsers.id }))[0];
        await this.addRoles(tx, created.id, data.roles, actor.id, now);
        await this.audit(tx, actor.id, created.id, "USER_CREATED", { roles: data.roles, active: data.active });
        if (data.active) token = await this.issueInvite(tx, created.id, actor.id, now);
        return created.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new UserManagementError("Já existe um usuário com este e-mail.");
      throw error;
    }
    const invitation = token ? await this.sendInvitation(actor.id, id, data.email, data.name, token) : null;
    return { id, invitation };
  }

  /**
   * Edição administrativa. Cada campo exige sua permissão. Tudo ocorre em uma transação serializada
   * pelo mesmo advisory lock do trigger do banco, que também impede ficar sem ADMIN ativo.
   */
  async update(actor: Actor, input: unknown): Promise<void> {
    const data = updateUserSchema.parse(input);
    const now = this.now();
    try {
      await this.db.transaction(async (tx) => {
        await tx.execute(ACTIVE_ADMINS_LOCK);
        const before = (await tx.select().from(adminUsers).where(eq(adminUsers.id, data.id)).for("update").limit(1))[0];
        if (!before) throw new UserManagementError("Usuário não encontrado.");
        if (before.version !== data.version) throw new UserConcurrencyError();
        const currentRoles = (await this.rolesFor([data.id], tx)).get(data.id) ?? [];
        const added = data.roles.filter((role) => !currentRoles.includes(role));
        const removed = currentRoles.filter((role) => !data.roles.includes(role));
        const emailChanged = before.email !== data.email;
        const nameChanged = before.name !== data.name;
        const activeChanged = before.active !== data.active;

        if (nameChanged || emailChanged) this.assert(actor, "users:update");
        if (activeChanged) this.assert(actor, "users:deactivate");
        if (added.length || removed.length) this.assert(actor, "users:assign-roles");
        if (actor.id === data.id && activeChanged && !data.active) throw new UserManagementError("Você não pode desativar o próprio acesso.");
        if (actor.id === data.id && removed.includes("ADMIN")) throw new UserManagementError("Você não pode remover o próprio perfil de administrador.");
        if (data.active && data.roles.length === 0) throw new UserManagementError("Atribua ao menos um perfil para manter o acesso ativo.");
        if (emailChanged && await this.emailInUse(tx, data.email, data.id)) throw new UserManagementError("Já existe um usuário com este e-mail.");

        // Revogação imediata de sessões e links quando a identidade ou o acesso mudam.
        const revokeSessions = emailChanged || (activeChanged && !data.active);
        await tx.update(adminUsers).set({
          name: data.name, email: data.email, active: data.active, updatedAt: now,
          version: sql`${adminUsers.version} + 1`,
          ...(revokeSessions ? { sessionVersion: sql`${adminUsers.sessionVersion} + 1` } : {}),
        }).where(eq(adminUsers.id, data.id));
        if (revokeSessions) await this.revokeTokens(tx, data.id, now);
        if (removed.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, data.id), inArray(userRoles.roleId, await this.roleIds(tx, removed))));
        await this.addRoles(tx, data.id, added, actor.id, now);

        if (nameChanged) await this.audit(tx, actor.id, data.id, "USER_UPDATED", { fields: ["name"] });
        if (emailChanged) await this.audit(tx, actor.id, data.id, "USER_EMAIL_CHANGED", { from: before.email, to: data.email, sessionsRevoked: true });
        if (activeChanged) await this.audit(tx, actor.id, data.id, data.active ? "USER_ACTIVATED" : "USER_DEACTIVATED", data.active ? {} : { sessionsRevoked: true });
        for (const role of added) await this.audit(tx, actor.id, data.id, "ROLE_ADDED", { role });
        for (const role of removed) await this.audit(tx, actor.id, data.id, "ROLE_REMOVED", { role });

        if (await this.activeAdminCount(tx) === 0) throw new LastAdminError();
      });
    } catch (error) {
      if (isLastAdminDatabaseError(error)) throw new LastAdminError();
      if (isUniqueViolation(error)) throw new UserManagementError("Já existe um usuário com este e-mail.");
      throw error;
    }
  }

  /** Novo convite invalida os anteriores. Só para contas ativas que ainda não definiram senha. */
  async resendInvite(actor: Actor, id: string): Promise<InvitationResult> {
    this.assert(actor, "users:update");
    const now = this.now();
    const { token, user } = await this.db.transaction(async (tx) => {
      const user = (await tx.select().from(adminUsers).where(eq(adminUsers.id, id)).for("update").limit(1))[0];
      if (!user) throw new UserManagementError("Usuário não encontrado.");
      if (!user.active || user.passwordHash) throw new UserManagementError("O convite só pode ser reenviado para contas ativas que ainda não definiram senha.");
      const roleCount = (await this.rolesFor([id], tx)).get(id)?.length ?? 0;
      if (roleCount === 0) throw new UserManagementError("Atribua ao menos um perfil antes de convidar.");
      await this.revokeTokens(tx, id, now, "INVITE");
      await tx.update(adminUsers).set({ invitedAt: now, updatedAt: now }).where(eq(adminUsers.id, id));
      return { token: await this.issueInvite(tx, id, actor.id, now), user };
    });
    return this.sendInvitation(actor.id, id, user.email, user.name, token);
  }

  private async sendInvitation(actorId: string, userId: string, email: string, name: string, token: string): Promise<InvitationResult> {
    const url = `${this.appOrigin()}/admin/convite?token=${encodeURIComponent(token)}`;
    const result = await this.email.send(invitationEmail(email, name, url, TOKEN_TTL_MS.INVITE / 3_600_000));
    await this.audit(this.db, actorId, userId, "INVITE_SENT", { delivered: result.delivered, provider: result.provider });
    return result;
  }

  private async issueInvite(tx: Tx, userId: string, actorId: string, now: Date): Promise<string> {
    const token = generateToken();
    await tx.insert(userTokens).values({ userId, purpose: "INVITE", tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS.INVITE), createdAt: now, createdBy: actorId });
    return token;
  }

  private async revokeTokens(tx: Tx, userId: string, now: Date, purpose?: "INVITE" | "PASSWORD_RESET"): Promise<void> {
    await tx.update(userTokens).set({ revokedAt: now })
      .where(and(eq(userTokens.userId, userId), isNull(userTokens.usedAt), isNull(userTokens.revokedAt), ...(purpose ? [eq(userTokens.purpose, purpose)] : [])));
  }

  private async emailInUse(tx: Tx, email: string, exceptId?: string): Promise<boolean> {
    const rows = await tx.select({ id: adminUsers.id }).from(adminUsers).where(sql`lower(${adminUsers.email}) = ${email.toLowerCase()}`).limit(2);
    return rows.some((row) => row.id !== exceptId);
  }

  private async roleIds(tx: Tx | Db, codes: RoleCode[]): Promise<string[]> {
    if (!codes.length) return [];
    const rows = await tx.select({ id: roles.id, code: roles.code }).from(roles).where(inArray(roles.code, codes));
    if (rows.length !== codes.length) throw new UserManagementError("Perfil inexistente.");
    return rows.map((row) => row.id);
  }

  private async addRoles(tx: Tx, userId: string, codes: RoleCode[], actorId: string, now: Date): Promise<void> {
    const ids = await this.roleIds(tx, codes);
    if (ids.length) await tx.insert(userRoles).values(ids.map((roleId) => ({ userId, roleId, assignedBy: actorId, createdAt: now }))).onConflictDoNothing();
  }

  private async rolesFor(ids: string[], tx: Tx | Db = this.db): Promise<Map<string, RoleCode[]>> {
    const map = new Map<string, RoleCode[]>();
    if (!ids.length) return map;
    const rows = await tx.select({ userId: userRoles.userId, code: roles.code }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(inArray(userRoles.userId, ids)).orderBy(asc(roles.code));
    for (const row of rows) map.set(row.userId, [...(map.get(row.userId) ?? []), row.code as RoleCode]);
    return map;
  }

  private async activeAdminCount(tx: Tx): Promise<number> {
    const rows = await tx.select({ total: count() }).from(adminUsers)
      .innerJoin(userRoles, eq(userRoles.userId, adminUsers.id)).innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(roles.code, "ADMIN"), eq(adminUsers.active, true)));
    return Number(rows[0]?.total ?? 0);
  }

  private async audit(tx: Tx | Db, actorId: string | null, targetId: string, action: string, metadata: Record<string, unknown>): Promise<void> {
    await tx.insert(userAuditEvents).values({ actorUserId: actorId, targetUserId: targetId, action, metadata: sanitizeAuditMetadata(metadata) });
  }

  private assert(actor: Actor, permission: Permission): void {
    if (!hasPermission(actor, permission)) throw new ForbiddenError([permission]);
  }
}
