import { createHmac } from "node:crypto";
import type { LoginAttempt } from "@/features/admin/auth/types";

export interface AttemptStore {
  getAttempt(key: string): Promise<LoginAttempt | null>;
  saveAttempt(key: string, attempt: LoginAttempt, at: Date): Promise<void>;
}

export class RateLimitError extends Error {
  constructor() { super("Muitas tentativas. Aguarde alguns minutos e tente novamente."); this.name = "RateLimitError"; }
}

/**
 * Janela fixa persistida no PostgreSQL (reutiliza admin_login_attempts).
 * As chaves são HMAC: e-mails, IPs e tokens não ficam legíveis no banco.
 */
export class RateLimiter {
  constructor(private readonly store: AttemptStore, private readonly secret: string) {}

  key(scope: string, value: string): string { return createHmac("sha256", this.secret).update(`${scope}:${value}`).digest("hex"); }

  async consume(scope: string, values: string[], max: number, windowMs: number, now = new Date()): Promise<void> {
    const keys = values.map((value) => this.key(scope, value || "unknown"));
    const current = await Promise.all(keys.map((key) => this.store.getAttempt(key)));
    const blocked = current.some((attempt) => attempt && now.getTime() - attempt.windowStartedAt.getTime() < windowMs && attempt.attempts >= max);
    await Promise.all(keys.map((key, index) => {
      const attempt = current[index];
      const active = attempt && now.getTime() - attempt.windowStartedAt.getTime() < windowMs;
      return this.store.saveAttempt(key, { attempts: active ? attempt.attempts + 1 : 1, windowStartedAt: active ? attempt.windowStartedAt : now, blockedUntil: null }, now);
    }));
    if (blocked) throw new RateLimitError();
  }
}
