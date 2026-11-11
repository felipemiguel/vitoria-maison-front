import { describe, expect, it, vi } from "vitest";
import { generateToken, hashToken, isWellFormedToken } from "./tokens";
import { RateLimiter, RateLimitError } from "./rate-limit";
import { getAppOrigin, isSameOriginRequest } from "./origin";
import { sanitizeAuditMetadata } from "./validation";
import { DevelopmentEmailProvider, DisabledEmailProvider, ResendEmailProvider, createEmailProvider } from "@/features/email/provider";
import { invitationEmail } from "@/features/email/templates";
import type { LoginAttempt } from "@/features/admin/auth/types";

class MemoryAttempts { map = new Map<string, LoginAttempt>(); async getAttempt(key: string) { return this.map.get(key) ?? null; } async saveAttempt(key: string, value: LoginAttempt) { this.map.set(key, value); } }

describe("tokens", () => {
  it("são aleatórios, bem formados e persistidos apenas como hash", () => {
    const a = generateToken(), b = generateToken();
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
    expect(isWellFormedToken("../../etc")).toBe(false);
  });
});

describe("rate limiting", () => {
  it("bloqueia após o limite na janela e libera depois", async () => {
    const limiter = new RateLimiter(new MemoryAttempts(), "segredo-de-teste");
    const now = new Date("2026-11-10T12:00:00Z");
    for (let i = 0; i < 3; i += 1) await limiter.consume("x", ["1.1.1.1"], 3, 60_000, now);
    await expect(limiter.consume("x", ["1.1.1.1"], 3, 60_000, now)).rejects.toBeInstanceOf(RateLimitError);
    await expect(limiter.consume("x", ["1.1.1.1"], 3, 60_000, new Date(now.getTime() + 61_000))).resolves.toBeUndefined();
  });
  it("não grava e-mail, IP ou token em claro", async () => {
    const store = new MemoryAttempts();
    await new RateLimiter(store, "segredo-de-teste").consume("reset", ["pessoa@exemplo.test"], 3, 60_000);
    expect([...store.map.keys()].join()).not.toContain("pessoa");
  });
});

describe("CSRF e origem", () => {
  it("aceita apenas requisições da mesma origem", () => {
    expect(isSameOriginRequest("https://painel.vitoria.test", "painel.vitoria.test")).toBe(true);
    expect(isSameOriginRequest("https://atacante.test", "painel.vitoria.test")).toBe(false);
    expect(isSameOriginRequest(null, "painel.vitoria.test")).toBe(false);
    expect(isSameOriginRequest("null", "painel.vitoria.test")).toBe(false);
  });
  it("links usam a origem configurada, nunca a requisição; HTTPS obrigatório em produção", () => {
    expect(getAppOrigin({ APP_URL: "https://painel.vitoria.test/qualquer", NODE_ENV: "production" })).toBe("https://painel.vitoria.test");
    expect(() => getAppOrigin({ APP_URL: "http://painel.vitoria.test", NODE_ENV: "production" })).toThrow();
    expect(() => getAppOrigin({ NODE_ENV: "production" })).toThrow();
    expect(getAppOrigin({ NODE_ENV: "development" })).toBe("http://localhost:3000");
  });
});

describe("auditoria", () => {
  it("remove senhas, hashes, tokens e segredos da metadata", () => {
    expect(sanitizeAuditMetadata({ role: "ADMIN", password: "x", passwordHash: "y", token: "z", nested: { apiKey: "k", ok: 1 } })).toEqual({ role: "ADMIN", nested: { ok: 1 } });
  });
});

describe("provider de e-mail", () => {
  const message = invitationEmail("pessoa@exemplo.test", "Pessoa <script>", "https://painel.vitoria.test/admin/convite?token=abc", 72);
  it("em produção sem configuração não envia nem registra o link", async () => {
    const provider = createEmailProvider({ NODE_ENV: "production" });
    expect(provider).toBeInstanceOf(DisabledEmailProvider);
    const log = vi.spyOn(console, "info");
    await expect(provider.send(message)).resolves.toEqual({ delivered: false, provider: "disabled" });
    expect(log).not.toHaveBeenCalled();
  });
  it("em desenvolvimento imprime no terminal e informa que NÃO entregou", async () => {
    const lines: string[] = [];
    await expect(new DevelopmentEmailProvider((line) => lines.push(line)).send(message)).resolves.toEqual({ delivered: false, provider: "development" });
    expect(lines.join()).toContain("/admin/convite?token=abc");
    expect(createEmailProvider({ NODE_ENV: "production", EMAIL_PROVIDER: "development" })).toBeInstanceOf(DisabledEmailProvider);
  });
  it("provider real exige credenciais e reporta falhas", async () => {
    expect(() => createEmailProvider({ EMAIL_PROVIDER: "resend" })).toThrow();
    const ok = vi.fn(async () => new Response("{}", { status: 200 }));
    await expect(new ResendEmailProvider("re_test", "Vitória <no-reply@vitoria.test>", ok as unknown as typeof fetch).send(message)).resolves.toEqual({ delivered: true, provider: "resend" });
    const fail = vi.fn(async () => new Response("{}", { status: 422 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(new ResendEmailProvider("re_test", "x@y.test", fail as unknown as typeof fetch).send(message)).resolves.toMatchObject({ delivered: false });
  });
  it("template escapa HTML e não contém senha", () => {
    expect(message.html).not.toContain("<script>");
    expect(message.text).not.toMatch(/sua senha (é|:)|senha provisória/i);
  });
});
