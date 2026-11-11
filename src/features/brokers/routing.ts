import type { BrokerSitesConfig } from "./config";
import { resolveHost } from "./hosts";

/** Prefixo interno das rotas dos sites. Nunca acessível diretamente: somente via rewrite por hostname. */
export const BROKER_SITE_INTERNAL_PREFIX = "/broker-site";

export type RouteDecision = { type: "next" } | { type: "rewrite"; pathname: string; subdomain: string } | { type: "notFound" };

/** Paths que jamais são servidos em hosts de corretores (painel, autenticação, APIs, metadados institucionais). */
const PUBLIC_ASSET = /^\/(?:images\/[a-z0-9/_.-]+|media\/[0-9a-f-]{36})$/i;
const BLOCKED_ON_BROKER_HOSTS = [/^\/admin(\/|$)/, /^\/api(\/|$)/, /^\/sitemap\.xml$/, /^\/og(\/|$)/];

export function routeRequest(host: string | null, pathname: string, config: BrokerSitesConfig): RouteDecision {
  if (pathname === BROKER_SITE_INTERNAL_PREFIX || pathname.startsWith(`${BROKER_SITE_INTERNAL_PREFIX}/`)) return { type: "notFound" };
  // Arquivos públicos (logo, imagens da marca) são servidos iguais em qualquer host.
  if (PUBLIC_ASSET.test(pathname)) return { type: "next" };
  const resolution = resolveHost(host, config);
  if (resolution.kind === "institutional") return { type: "next" };
  if (resolution.kind !== "broker" || !config.enabled) return { type: "notFound" };
  if (BLOCKED_ON_BROKER_HOSTS.some((pattern) => pattern.test(pathname))) return { type: "notFound" };
  return { type: "rewrite", subdomain: resolution.subdomain, pathname: `${BROKER_SITE_INTERNAL_PREFIX}/${resolution.subdomain}${pathname === "/" ? "" : pathname}` };
}
