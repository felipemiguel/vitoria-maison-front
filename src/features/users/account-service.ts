import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminUsers, userAuditEvents, userTokens } from "@/database/schema";
import type { SessionUser } from "@/features/access/session-user";
import type { EmailProvider } from "@/features/email/provider";
import { passwordResetEmail } from "@/features/email/templates";
import { InvalidTokenError, UserManagementError } from "./errors";
import type { RateLimiter } from "./rate-limit";
import { TOKEN_TTL_MS, generateToken, hashToken, isWellFormedToken, type TokenPurpose } from "./tokens";
import { newPasswordSchema, sanitizeAuditMetadata, userEmailSchema, userNameSchema } from "./validation";

type Db = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type AccountDependencies = {
  email: EmailProvider;
  rateLimiter: RateLimiter;
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (hash: string, password: string) => Promise<boolean>;
  appOrigin: () => string;
  now?: () => Date;
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/** Fluxos self-service. Nenhuma resposta revela se a conta existe, está inativa ou se o token expirou. */
export class AccountService {
  private readonly now: () => Date;
  constructor(private readonly db: Db, private readonly deps: AccountDependencies) { this.now = deps.now ?? (() => new Date()); }

  /** Valida o token sem consumi-lo (para exibir o formulário). Não diferencia os motivos de falha. */
  async isTokenUsable(purpose: TokenPurpose, token: unknown): Promise<boolean> {
    if (!isWellFormedToken(token)) return false;
    const row = await this.findToken(this.db, purpose, token);
    return Boolean(row);
  }

  async acceptInvite(input: { token: unknown; password: unknown; confirmation: unknown }, ip: string): Promise<void> {
    await this.deps.rateLimiter.consume("invite-accept", [ip], 10, FIFTEEN_MINUTES, this.now());
    const passwords = newPasswordSchema.parse({ password: input.password, confirmation: input.confirmation });
    await this.consumeToken("INVITE", input.token, passwords.password, (user) => user.passwordHash === null, "INVITE_ACCEPTED", { invitationAcceptedAt: this.now() });
  }

  /** Sempre conclui sem erro visível; só envia e-mail para contas ativas que já têm senha. */
  async requestPasswordReset(rawEmail: unknown, ip: string): Promise<void> {
    const parsed = userEmailSchema.safeParse(rawEmail);
    const email = parsed.success ? parsed.data : "invalid";
    await this.deps.rateLimiter.consume("password-reset-request", [ip], 10, FIFTEEN_MINUTES, this.now());
    await this.deps.rateLimiter.consume("password-reset-email", [email], 3, ONE_HOUR, this.now());
    if (!parsed.success) return;
    const now = this.now();
    const issued = await this.db.transaction(async (tx) => {
      const user = (await tx.select().from(adminUsers).where(sql`lower(${adminUsers.email}) = ${email}`).for("update").limit(1))[0];
      if (!user || !user.active || !user.passwordHash) return null;
      await tx.update(userTokens).set({ revokedAt: now }).where(and(eq(userTokens.userId, user.id), eq(userTokens.purpose, "PASSWORD_RESET"), isNull(userTokens.usedAt), isNull(userTokens.revokedAt)));
      const token = generateToken();
      await tx.insert(userTokens).values({ userId: user.id, purpose: "PASSWORD_RESET", tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS.PASSWORD_RESET), createdAt: now });
      await this.audit(tx, null, user.id, "PASSWORD_RESET_REQUESTED", {});
      return { token, user };
    });
    if (!issued) return;
    const url = `${this.deps.appOrigin()}/admin/redefinir-senha?token=${encodeURIComponent(issued.token)}`;
    const result = await this.deps.email.send(passwordResetEmail(issued.user.email, issued.user.name, url, TOKEN_TTL_MS.PASSWORD_RESET / 60_000));
    await this.audit(this.db, null, issued.user.id, "PASSWORD_RESET_EMAIL", { delivered: result.delivered, provider: result.provider });
  }

  async resetPassword(input: { token: unknown; password: unknown; confirmation: unknown }, ip: string): Promise<void> {
    await this.deps.rateLimiter.consume("password-reset", [ip], 10, FIFTEEN_MINUTES, this.now());
    const passwords = newPasswordSchema.parse({ password: input.password, confirmation: input.confirmation });
    await this.consumeToken("PASSWORD_RESET", input.token, passwords.password, (user) => user.passwordHash !== null, "PASSWORD_RESET_COMPLETED", {});
  }

  /** Troca da própria senha com reautenticação. Encerra todas as sessões, inclusive a atual. */
  async changeOwnPassword(user: Pick<SessionUser, "id">, input: { current: unknown; password: unknown; confirmation: unknown }): Promise<void> {
    await this.deps.rateLimiter.consume("password-change", [user.id], 5, FIFTEEN_MINUTES, this.now());
    const passwords = newPasswordSchema.parse({ password: input.password, confirmation: input.confirmation });
    const row = (await this.db.select().from(adminUsers).where(eq(adminUsers.id, user.id)).limit(1))[0];
    const current = typeof input.current === "string" ? input.current : "";
    if (!row?.active || !row.passwordHash || !(await this.deps.verifyPassword(row.passwordHash, current))) throw new UserManagementError("A senha atual não confere.");
    if (await this.deps.verifyPassword(row.passwordHash, passwords.password)) throw new UserManagementError("A nova senha deve ser diferente da atual.");
    const hash = await this.deps.hashPassword(passwords.password);
    const now = this.now();
    await this.db.transaction(async (tx) => {
      await tx.update(adminUsers).set({ passwordHash: hash, sessionVersion: sql`${adminUsers.sessionVersion} + 1`, updatedAt: now }).where(eq(adminUsers.id, user.id));
      await tx.update(userTokens).set({ revokedAt: now }).where(and(eq(userTokens.userId, user.id), isNull(userTokens.usedAt), isNull(userTokens.revokedAt)));
      await this.audit(tx, user.id, user.id, "PASSWORD_CHANGED", { sessionsRevoked: true });
    });
  }

  /** Somente o nome. E-mail, perfis e status são alterados apenas por administradores. */
  async updateOwnProfile(user: Pick<SessionUser, "id">, input: { name: unknown }): Promise<void> {
    const name = userNameSchema.parse(input.name);
    await this.db.transaction(async (tx) => {
      const before = (await tx.select({ name: adminUsers.name }).from(adminUsers).where(and(eq(adminUsers.id, user.id), eq(adminUsers.active, true))).limit(1))[0];
      if (!before) throw new UserManagementError("Conta não encontrada.");
      if (before.name === name) return;
      await tx.update(adminUsers).set({ name, updatedAt: this.now(), version: sql`${adminUsers.version} + 1` }).where(eq(adminUsers.id, user.id));
      await this.audit(tx, user.id, user.id, "PROFILE_UPDATED", { fields: ["name"] });
    });
  }

  async getOwnAccount(user: Pick<SessionUser, "id">) {
    return (await this.db.select({ name: adminUsers.name, email: adminUsers.email, createdAt: adminUsers.createdAt, lastLoginAt: adminUsers.lastLoginAt }).from(adminUsers).where(eq(adminUsers.id, user.id)).limit(1))[0] ?? null;
  }

  private async findToken(tx: Tx | Db, purpose: TokenPurpose, token: string, lock = false) {
    const query = tx.select({ id: userTokens.id, userId: userTokens.userId, passwordHash: adminUsers.passwordHash })
      .from(userTokens).innerJoin(adminUsers, eq(adminUsers.id, userTokens.userId))
      .where(and(
        eq(userTokens.tokenHash, hashToken(token)), eq(userTokens.purpose, purpose),
        isNull(userTokens.usedAt), isNull(userTokens.revokedAt), sql`${userTokens.expiresAt} > ${this.now()}`,
        eq(adminUsers.active, true),
      )).limit(1);
    return (await (lock ? query.for("update") : query))[0] ?? null;
  }

  /**
   * Consome o token uma única vez (bloqueio de linha + used_at), define a senha, revoga os demais
   * tokens do usuário e incrementa session_version (sessões anteriores deixam de valer).
   */
  private async consumeToken(purpose: TokenPurpose, token: unknown, password: string, accountMatches: (user: { passwordHash: string | null }) => boolean, action: string, extra: Partial<typeof adminUsers.$inferInsert>): Promise<void> {
    if (!isWellFormedToken(token)) throw new InvalidTokenError();
    const hash = await this.deps.hashPassword(password);
    const now = this.now();
    await this.db.transaction(async (tx) => {
      const row = await this.findToken(tx, purpose, token, true);
      if (!row || !accountMatches(row)) throw new InvalidTokenError();
      const used = await tx.update(userTokens).set({ usedAt: now }).where(and(eq(userTokens.id, row.id), isNull(userTokens.usedAt))).returning({ id: userTokens.id });
      if (!used[0]) throw new InvalidTokenError();
      await tx.update(userTokens).set({ revokedAt: now }).where(and(eq(userTokens.userId, row.userId), ne(userTokens.id, row.id), isNull(userTokens.usedAt), isNull(userTokens.revokedAt)));
      await tx.update(adminUsers).set({ ...extra, passwordHash: hash, sessionVersion: sql`${adminUsers.sessionVersion} + 1`, updatedAt: now }).where(eq(adminUsers.id, row.userId));
      await this.audit(tx, row.userId, row.userId, action, {});
    });
  }

  private async audit(tx: Tx | Db, actorId: string | null, targetId: string, action: string, metadata: Record<string, unknown>): Promise<void> {
    await tx.insert(userAuditEvents).values({ actorUserId: actorId, targetUserId: targetId, action, metadata: sanitizeAuditMetadata(metadata) });
  }
}
