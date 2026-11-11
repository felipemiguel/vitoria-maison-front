import { eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminLoginAttempts, adminUsers } from "@/database/schema";
import type { AdminAuthStore, AdminCredentialRecord, LoginAttempt } from "./types";

export class DrizzleAdminAuthStore implements AdminAuthStore {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findByEmail(email: string): Promise<AdminCredentialRecord | null> {
    const row = (await this.db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1))[0];
    return row ? { id: row.id, name: row.name, email: row.email, passwordHash: row.passwordHash, active: row.active, sessionVersion: row.sessionVersion } : null;
  }

  async markLogin(id: string, at: Date): Promise<void> {
    await this.db.update(adminUsers).set({ lastLoginAt: at, updatedAt: at }).where(eq(adminUsers.id, id));
  }

  async getAttempt(key: string): Promise<LoginAttempt | null> {
    const row = (await this.db.select().from(adminLoginAttempts).where(eq(adminLoginAttempts.attemptKey, key)).limit(1))[0];
    return row ? { attempts: row.attempts, windowStartedAt: row.windowStartedAt, blockedUntil: row.blockedUntil } : null;
  }

  async saveAttempt(key: string, attempt: LoginAttempt, at: Date): Promise<void> {
    await this.db.insert(adminLoginAttempts).values({ attemptKey: key, ...attempt, updatedAt: at }).onConflictDoUpdate({
      target: adminLoginAttempts.attemptKey,
      set: { attempts: attempt.attempts, windowStartedAt: attempt.windowStartedAt, blockedUntil: attempt.blockedUntil, updatedAt: at },
    });
  }

  async clearAttempts(keys: string[]): Promise<void> {
    if (keys.length) await this.db.delete(adminLoginAttempts).where(inArray(adminLoginAttempts.attemptKey, keys));
  }
}
