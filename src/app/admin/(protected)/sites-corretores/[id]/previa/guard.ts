import { notFound } from "next/navigation";
import { requirePagePermission } from "@/features/access/server";
import { createBrokerServices } from "@/features/brokers/factory";
import { BrokerSiteNotFoundError } from "@/features/brokers/errors";

/** Prévia administrativa: exige broker-site:manage-all; site inexistente → 404. */
export async function authorizeAdminPreview(id: string): Promise<string> {
  const user = await requirePagePermission("broker-site:manage-all");
  try { await createBrokerServices().sites.authorize(user, id, "preview"); } catch (error) { if (error instanceof BrokerSiteNotFoundError) notFound(); throw error; }
  return `/admin/sites-corretores/${id}/previa`;
}
