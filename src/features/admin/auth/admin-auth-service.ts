import { createHmac } from "node:crypto";
import { z } from "zod";
import type { AdminAuthStore, AuthenticatedIdentity, LoginAttempt } from "./types";
import { ADMIN_LOGIN_BLOCK_MS, ADMIN_LOGIN_MAX_ATTEMPTS, ADMIN_LOGIN_WINDOW_MS } from "./config";

const credentialsSchema = z.object({ email: z.string().trim().toLowerCase().email().max(320), password: z.string().min(1).max(200) });

type PasswordVerifier = (hash: string, password: string) => Promise<boolean>;

export class AdminAuthService {
  constructor(
    private readonly store: AdminAuthStore,
    private readonly secret: string,
    private readonly verifyPassword: PasswordVerifier,
    private readonly dummyHash: Promise<string>,
  ) {}

  async authenticate(input: unknown, ip: string, now = new Date()): Promise<AuthenticatedIdentity | null> {
    const parsed = credentialsSchema.safeParse(input);
    if (!parsed.success) return null;
    const keys = [this.key(`email:${parsed.data.email}`), this.key(`ip:${ip || "unknown"}`)];
    const attempts = await Promise.all(keys.map((key) => this.store.getAttempt(key)));
    if (attempts.some((attempt) => attempt?.blockedUntil && attempt.blockedUntil > now)) return null;

    const user = await this.store.findByEmail(parsed.data.email);
    // Conta sem senha (convite pendente) passa pela mesma verificação com hash fictício: resposta e tempo equivalentes.
    const validPassword = await this.verifyPassword(user?.passwordHash ?? await this.dummyHash, parsed.data.password);
    if (!user || !user.active || !user.passwordHash || !validPassword) {
      await Promise.all(keys.map((key, index) => this.recordFailure(key, attempts[index], now)));
      return null;
    }

    await this.store.clearAttempts(keys);
    await this.store.markLogin(user.id, now);
    return { id: user.id, name: user.name, email: user.email, sessionVersion: user.sessionVersion };
  }

  private key(value: string): string { return createHmac("sha256", this.secret).update(value).digest("hex"); }

  private async recordFailure(key: string, current: LoginAttempt | null, now: Date): Promise<void> {
    const activeWindow = current && now.getTime() - current.windowStartedAt.getTime() < ADMIN_LOGIN_WINDOW_MS;
    const attempts = activeWindow ? current.attempts + 1 : 1;
    await this.store.saveAttempt(key, {
      attempts,
      windowStartedAt: activeWindow ? current.windowStartedAt : now,
      blockedUntil: attempts >= ADMIN_LOGIN_MAX_ATTEMPTS ? new Date(now.getTime() + ADMIN_LOGIN_BLOCK_MS) : null,
    }, now);
  }
}
