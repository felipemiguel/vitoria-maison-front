import { notFound } from "next/navigation";
import { BrokerHeader } from "@/components/broker-site/broker-header";
import { BrokerFooter } from "@/components/broker-site/broker-footer";
import { PUBLIC_LINKS } from "@/components/broker-site/links";
import { resolveRequestSite } from "@/features/brokers/request-site";

export const dynamic = "force-dynamic";

/**
 * Layout dos sites de corretores (rota interna alcançada só por rewrite de hostname).
 * O site é resolvido pelo Host validado; não publicado, suspenso ou inexistente → 404.
 */
export default async function BrokerSiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ subdomain: string }> }) {
  const site = await resolveRequestSite((await params).subdomain);
  if (!site) notFound();
  return <><BrokerHeader name={site.displayName} links={PUBLIC_LINKS}/><main>{children}</main><BrokerFooter name={site.displayName}/></>;
}
