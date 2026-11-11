/**
 * Configuração central de domínios.
 *
 * - Domínio institucional: host de NEXT_PUBLIC_SITE_URL (+ www, localhost, 127.0.0.1).
 * - Domínio-base dos corretores: BROKER_SITES_BASE_DOMAIN (ex.: vitoriamaison.com.br → ana.vitoriamaison.com.br).
 * - Domínios de desenvolvimento (*.localhost, *.lvh.me) só são aceitos fora de produção.
 * - Previews e hosts externos (ex.: *.vercel.app) são sempre tratados como institucionais, nunca como corretor.
 * BROKER_SITES_ENABLED=false (padrão) desliga a resolução pública: subdomínios respondem 404.
 */

export type BrokerSitesConfig = {
  enabled: boolean;
  baseDomain: string | null;
  institutionalHosts: ReadonlySet<string>;
  protocol: "https" | "http";
  /** Porta incluída nos links apenas em desenvolvimento. */
  port: string | null;
  problems: string[];
};

type Env = Partial<Record<string, string | undefined>>;

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;
const DEV_SUFFIXES = ["localhost", "lvh.me"];

export function isDevelopmentDomain(host: string): boolean {
  return DEV_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function hostOf(url: string | undefined): string | null {
  try { return url ? new URL(url).hostname.toLowerCase() : null; } catch { return null; }
}

export function getBrokerSitesConfig(env: Env = process.env): BrokerSitesConfig {
  const production = env.NODE_ENV === "production";
  const problems: string[] = [];
  let baseDomain: string | null = env.BROKER_SITES_BASE_DOMAIN?.trim().toLowerCase().replace(/\.$/, "") || null;
  if (baseDomain && !HOSTNAME.test(baseDomain)) { problems.push("BROKER_SITES_BASE_DOMAIN inválido."); baseDomain = null; }
  if (baseDomain && production && isDevelopmentDomain(baseDomain)) { problems.push("Domínio de desenvolvimento não é aceito em produção."); baseDomain = null; }
  const requested = env.BROKER_SITES_ENABLED?.trim() === "true";
  if (requested && !baseDomain) problems.push("BROKER_SITES_ENABLED=true exige BROKER_SITES_BASE_DOMAIN válido.");

  const institutional = new Set<string>(["localhost", "127.0.0.1"]);
  const siteHost = hostOf(env.NEXT_PUBLIC_SITE_URL);
  if (siteHost) { institutional.add(siteHost); institutional.add(siteHost.startsWith("www.") ? siteHost.slice(4) : `www.${siteHost}`); }
  if (baseDomain) { institutional.add(baseDomain); institutional.add(`www.${baseDomain}`); }

  return {
    enabled: requested && Boolean(baseDomain),
    baseDomain,
    institutionalHosts: institutional,
    protocol: production ? "https" : "http",
    port: production ? null : (env.BROKER_SITES_DEV_PORT?.trim() || env.PORT?.trim() || "3000"),
    problems,
  };
}
