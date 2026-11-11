export type AdminIdentity = { id: string; name: string; email: string };
export type AuthenticatedIdentity = AdminIdentity & { sessionVersion: number };
/** passwordHash é nulo em contas convidadas que ainda não definiram senha. */
export type AdminCredentialRecord = AdminIdentity & { passwordHash: string | null; active: boolean; sessionVersion: number };
export type LoginAttempt = { attempts: number; windowStartedAt: Date; blockedUntil: Date | null };

export interface AdminAuthStore {
  findByEmail(email: string): Promise<AdminCredentialRecord | null>;
  markLogin(id: string, at: Date): Promise<void>;
  getAttempt(key: string): Promise<LoginAttempt | null>;
  saveAttempt(key: string, attempt: LoginAttempt, at: Date): Promise<void>;
  clearAttempts(keys: string[]): Promise<void>;
}
