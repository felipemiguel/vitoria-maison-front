import { describe, expect, it, vi } from "vitest";
import { AdminAuthService } from "./admin-auth-service";
import { ADMIN_LOGIN_MAX_ATTEMPTS, ADMIN_SESSION_MAX_AGE_SECONDS } from "./config";
import type { AdminAuthStore, AdminCredentialRecord, LoginAttempt } from "./types";

const activeUser: AdminCredentialRecord = { id: "user-1", name: "Admin Teste", email: "admin@example.test", passwordHash: "valid-hash", active: true, sessionVersion: 3 };

class MemoryAuthStore implements AdminAuthStore {
  user: AdminCredentialRecord | null = activeUser;
  attempts = new Map<string, LoginAttempt>();
  lastLoginAt: Date | null = null;
  async findByEmail(email: string) { return this.user?.email === email ? this.user : null; }
  async markLogin(_id: string, at: Date) { this.lastLoginAt = at; }
  async findActiveById(id: string) { return this.user?.id === id && this.user.active ? { id: this.user.id, name: this.user.name, email: this.user.email } : null; }
  async getAttempt(key: string) { return this.attempts.get(key) ?? null; }
  async saveAttempt(key: string, value: LoginAttempt) { this.attempts.set(key, value); }
  async clearAttempts(keys: string[]) { keys.forEach((key) => this.attempts.delete(key)); }
}

function setup(store = new MemoryAuthStore()) {
  const verify = vi.fn(async (hash: string, password: string) => hash === "valid-hash" && password === "correct-password");
  return { store, verify, service: new AdminAuthService(store, "test-secret-with-enough-entropy", verify, Promise.resolve("dummy-hash")) };
}

describe("AdminAuthService", () => {
  it("valida login e atualiza o último acesso", async () => {
    const { service, store } = setup(); const now = new Date("2026-11-07T12:00:00Z");
    await expect(service.authenticate({ email: "ADMIN@example.test", password: "correct-password" }, "127.0.0.1", now)).resolves.toEqual({ id: "user-1", name: "Admin Teste", email: "admin@example.test", sessionVersion: 3 });
    expect(store.lastLoginAt).toEqual(now);
  });
  it("usa trabalho equivalente e resposta genérica para usuário inexistente", async () => {
    const { service, store, verify } = setup(); store.user = null;
    await expect(service.authenticate({ email: "missing@example.test", password: "wrong" }, "127.0.0.1")).resolves.toBeNull();
    expect(verify).toHaveBeenCalledWith("dummy-hash", "wrong");
  });
  it("rejeita usuário inativo", async () => {
    const { service, store } = setup(); store.user = { ...activeUser, active: false };
    await expect(service.authenticate({ email: activeUser.email, password: "correct-password" }, "127.0.0.1")).resolves.toBeNull();
  });
  it("rejeita conta convidada que ainda não definiu senha, com trabalho equivalente", async () => {
    const { service, store, verify } = setup(); store.user = { ...activeUser, passwordHash: null };
    await expect(service.authenticate({ email: activeUser.email, password: "qualquer" }, "127.0.0.1")).resolves.toBeNull();
    expect(verify).toHaveBeenCalledWith("dummy-hash", "qualquer");
  });
  it("bloqueia novas tentativas após o limite", async () => {
    const { service, verify } = setup(); const now = new Date("2026-11-07T12:00:00Z");
    for (let index=0;index<ADMIN_LOGIN_MAX_ATTEMPTS;index+=1) await service.authenticate({ email: activeUser.email, password: "wrong" }, "127.0.0.1", now);
    verify.mockClear();
    await expect(service.authenticate({ email: activeUser.email, password: "correct-password" }, "127.0.0.1", now)).resolves.toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });
  it("mantém sessão administrativa curta", () => expect(ADMIN_SESSION_MAX_AGE_SECONDS).toBe(28_800));
});
