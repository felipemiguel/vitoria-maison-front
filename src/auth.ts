import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { hashAdminPassword, verifyAdminPassword } from "@/features/admin/auth/password";
import { AdminAuthService } from "@/features/admin/auth/admin-auth-service";
import { DrizzleAdminAuthStore } from "@/features/admin/auth/drizzle-admin-auth-store";
import { getDatabase } from "@/database/client";
import { ADMIN_SESSION_MAX_AGE_SECONDS } from "@/features/admin/auth/config";

const dummyHash = hashAdminPassword("invalid-password-used-only-for-equal-work");

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt", maxAge: ADMIN_SESSION_MAX_AGE_SECONDS },
  providers: [Credentials({
    credentials: { email: { type: "email" }, password: { type: "password" } },
    authorize: async (credentials, request) => {
      const secret = process.env.AUTH_SECRET;
      if (!secret) throw new Error("AUTH_SECRET não configurado.");
      const ip = request.headers.get("cf-connecting-ip")
        ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? "unknown";
      return new AdminAuthService(new DrizzleAdminAuthStore(getDatabase()), secret, verifyAdminPassword, dummyHash)
        .authenticate(credentials, ip);
    },
  })],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) { token.adminId = user.id; token.sessionVersion = user.sessionVersion ?? 0; }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.adminId === "string") session.user.id = token.adminId;
      // Perfis e permissões NÃO entram no token: são lidos do banco a cada requisição.
      session.sessionVersion = typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-vitoria-admin.session-token" : "vitoria-admin.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
});
