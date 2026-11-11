import type { MetadataRoute } from "next";
import { absoluteUrl, type SeoConfig } from "./config";

/**
 * robots.txt controla RASTREAMENTO, não indexação nem acesso:
 * - páginas públicas, filtros e admin continuam rastreáveis para que o `noindex` seja lido;
 * - apenas /api/ é bloqueado (não há conteúdo HTML ali);
 * - o sitemap só é anunciado quando a indexação está liberada.
 * A proteção do painel é a autenticação; robots.txt não é mecanismo de segurança.
 */
export function buildRobots(config: SeoConfig): MetadataRoute.Robots {
  const rules: MetadataRoute.Robots["rules"] = [{ userAgent: "*", allow: "/", disallow: ["/api/"] }];
  if (!config.indexingEnabled) return { rules };
  return { rules, sitemap: absoluteUrl(config, "/sitemap.xml") };
}
