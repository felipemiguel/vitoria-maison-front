import { notFound } from "next/navigation";
import { requirePagePermission } from "@/features/access/server";
import { createBrokerServices } from "@/features/brokers/factory";

/** Prévia do próprio site: o site vem da sessão (propriedade), nunca de parâmetro da URL. */
export async function authorizeOwnPreview(): Promise<{ siteId: string; base: string }> {
  const user = await requirePagePermission("broker-site:read-own");
  const site = await createBrokerServices().sites.getOwn(user);
  if (!site) notFound();
  return { siteId: site.id, base: "/admin/meu-site/previa" };
}
