import "next-auth";
declare module "next-auth" {
  interface Session {
    user: { id: string; name: string; email: string };
    /** Versão da sessão no login; comparada com admin_users.session_version a cada requisição. */
    sessionVersion?: number;
  }
  interface User { sessionVersion?: number }
}
