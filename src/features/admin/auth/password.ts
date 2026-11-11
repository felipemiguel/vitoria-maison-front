import { hash, verify, argon2id } from "argon2";
import { z } from "zod";

export const adminPasswordSchema = z.string().min(12, "A senha deve ter pelo menos 12 caracteres.").max(200);

export async function hashAdminPassword(password: string): Promise<string> {
  return hash(adminPasswordSchema.parse(password), { type: argon2id });
}

export async function verifyAdminPassword(passwordHash: string, password: string): Promise<boolean> {
  try { return await verify(passwordHash, password); } catch { return false; }
}
