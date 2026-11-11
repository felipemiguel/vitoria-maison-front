import type { BrokerSitesConfig } from "./config";
import { isReservedSubdomain, isValidSubdomainFormat } from "./subdomain-rules";

export type HostResolution =
  | { kind: "institutional" }
  | { kind: "broker"; subdomain: string }
  | { kind: "reserved" }
  | { kind: "invalid" };

/** Normaliza o cabeçalho Host: minúsculas, sem porta, sem ponto final. Retorna null se inválido. */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let host = raw.trim().toLowerCase();
  if (host.startsWith("[")) return host; // IPv6 literal: nunca é site de corretor
  host = host.replace(/:\d{1,5}$/, "").replace(/\.$/, "");
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.includes("..")) return null;
  return host;
}

/**
 * Resolve o hostname. Somente o cabeçalho Host (definido pela plataforma) é considerado;
 * X-Forwarded-Host e query parameters nunca determinam o site.
 */
export function resolveHost(rawHost: string | null | undefined, config: Pick<BrokerSitesConfig, "baseDomain" | "institutionalHosts">): HostResolution {
  const host = normalizeHost(rawHost);
  if (host === null) return { kind: "invalid" };
  if (host.startsWith("[") || config.institutionalHosts.has(host) || !config.baseDomain) return { kind: "institutional" };
  const suffix = `.${config.baseDomain}`;
  if (!host.endsWith(suffix)) return { kind: "institutional" }; // hosts externos/preview: nunca viram corretor
  const label = host.slice(0, -suffix.length);
  if (label.includes(".") || !isValidSubdomainFormat(label)) return { kind: "invalid" };
  if (isReservedSubdomain(label)) return { kind: "reserved" };
  return { kind: "broker", subdomain: label };
}

/** Endereço público canônico de um site de corretor. */
export function brokerSiteUrl(subdomain: string, config: Pick<BrokerSitesConfig, "baseDomain" | "protocol" | "port">): string | null {
  if (!config.baseDomain) return null;
  return `${config.protocol}://${subdomain}.${config.baseDomain}${config.port ? `:${config.port}` : ""}/`;
}
