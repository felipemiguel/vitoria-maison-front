import { getDatabase } from "@/database/client";
import { DrizzleAdminAuthStore } from "@/features/admin/auth/drizzle-admin-auth-store";
import { hashAdminPassword, verifyAdminPassword } from "@/features/admin/auth/password";
import { createEmailProvider } from "@/features/email/provider";
import { AccountService } from "./account-service";
import { getAppOrigin } from "./origin";
import { RateLimiter } from "./rate-limit";
import { UserManagementService } from "./user-management-service";

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET não configurado.");
  return value;
}

export function createUserManagementService(): UserManagementService {
  return new UserManagementService(getDatabase(), createEmailProvider(), () => getAppOrigin());
}

export function createAccountService(): AccountService {
  const db = getDatabase();
  return new AccountService(db, {
    email: createEmailProvider(),
    rateLimiter: new RateLimiter(new DrizzleAdminAuthStore(db), secret()),
    hashPassword: hashAdminPassword,
    verifyPassword: verifyAdminPassword,
    appOrigin: () => getAppOrigin(),
  });
}
