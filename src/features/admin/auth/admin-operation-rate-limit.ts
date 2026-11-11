import { createHmac } from "node:crypto";
import { getDatabase } from "@/database/client";
import { DrizzleAdminAuthStore } from "./drizzle-admin-auth-store";

const WINDOW_MS = 60_000;
const MAX_VISTA_OPERATIONS = 10;

export class AdminOperationRateLimitError extends Error {}

export async function enforceAdminVistaRateLimit(adminId: string, now = new Date()): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado.");
  const key = createHmac("sha256", secret).update(`vista-operation:${adminId}`).digest("hex");
  const store = new DrizzleAdminAuthStore(getDatabase());
  const current = await store.getAttempt(key);
  const activeWindow = current && now.getTime() - current.windowStartedAt.getTime() < WINDOW_MS;
  const attempts = activeWindow ? current.attempts + 1 : 1;
  if (activeWindow && current.attempts >= MAX_VISTA_OPERATIONS) throw new AdminOperationRateLimitError("Muitas consultas ao Vista. Aguarde um minuto.");
  await store.saveAttempt(key, { attempts, windowStartedAt: activeWindow ? current.windowStartedAt : now, blockedUntil: null }, now);
}
