import { cache } from "react";
import { headers } from "next/headers";
import { getDatabase } from "@/database/client";
import { getBrokerSitesConfig } from "./config";
import { resolveHost } from "./hosts";
import { findPublishedSiteBySubdomain, type BrokerSiteView } from "./public-site-service";

/**
 * Site da requisição atual. Defesa em profundidade além do proxy: o Host é resolvido de novo e
 * precisa corresponder ao subdomínio do caminho interno. Assim, acessar /broker-site/ana pelo
 * domínio institucional (ou por outro subdomínio) nunca exibe o site da Ana.
 * Deduplicado por requisição; não há cache entre requisições nem entre hostnames.
 */
export const resolveRequestSite = cache(async (subdomainParam: string): Promise<BrokerSiteView | null> => {
  const config = getBrokerSitesConfig();
  if (!config.enabled) return null;
  const resolution = resolveHost((await headers()).get("host"), config);
  if (resolution.kind !== "broker" || resolution.subdomain !== subdomainParam) return null;
  return findPublishedSiteBySubdomain(getDatabase(), resolution.subdomain);
});
