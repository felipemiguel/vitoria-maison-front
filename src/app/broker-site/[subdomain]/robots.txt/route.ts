import { resolveRequestSite } from "@/features/brokers/request-site";
import { brokerSiteIndexable } from "@/features/brokers/site-seo";

export const dynamic = "force-dynamic";

/** Site publicado e indexação liberada: rastreável (sem sitemap nesta fase). Caso contrário, bloqueio total. */
export async function GET(_request: Request, { params }: { params: Promise<{ subdomain: string }> }) {
  const site = await resolveRequestSite((await params).subdomain);
  const allow = site ? brokerSiteIndexable(site) : false;
  return new Response(allow ? "User-agent: *\nAllow: /\n" : "User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
