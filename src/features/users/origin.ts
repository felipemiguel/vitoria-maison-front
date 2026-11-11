/**
 * Origem canônica da aplicação para links de convite e recuperação.
 * Nunca é derivada de cabeçalhos da requisição nem de dados enviados pelo cliente.
 */
export function getAppOrigin(env: Partial<Record<string, string | undefined>> = process.env): string {
  const raw = env.APP_URL?.trim() || env.AUTH_URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim() || (env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("APP_URL não configurada: defina a origem HTTPS do painel."); }
  if (env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("APP_URL deve usar HTTPS em produção.");
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("APP_URL inválida.");
  return url.origin;
}

/**
 * Defesa adicional contra CSRF (além da verificação nativa de Origin das Server Actions):
 * a requisição precisa vir da mesma origem do host atendido.
 */
export function isSameOriginRequest(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase(); } catch { return false; }
}
