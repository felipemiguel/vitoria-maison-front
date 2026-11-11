import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type TokenPurpose = "INVITE" | "PASSWORD_RESET";
export const TOKEN_TTL_MS: Record<TokenPurpose, number> = { INVITE: 72 * 60 * 60 * 1000, PASSWORD_RESET: 60 * 60 * 1000 };

/** 32 bytes aleatórios (256 bits) em base64url. O valor só existe no link enviado por e-mail. */
export function generateToken(): string { return randomBytes(32).toString("base64url"); }

/** SHA-256 é suficiente para tokens de alta entropia; somente o hash é persistido. */
export function hashToken(token: string): string { return createHash("sha256").update(token, "utf8").digest("hex"); }

export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
