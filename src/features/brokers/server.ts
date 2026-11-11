import { requireUser } from "@/features/access/server";
import type { BrokerSiteAction } from "./broker-site-service";
import { createBrokerServices } from "./factory";

/**
 * Exige sessão válida, permissão e propriedade do site. O usuário vem da sessão (servidor),
 * nunca de IDs enviados pelo navegador. Site de outro corretor → "Site não encontrado".
 */
export async function requireBrokerSiteAccess({ siteId, action }: { siteId: string; action: BrokerSiteAction }) {
  const user = await requireUser();
  const site = await createBrokerServices().sites.authorize(user, siteId, action);
  return { user, site };
}
