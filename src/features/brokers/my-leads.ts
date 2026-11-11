import { getDatabase } from "@/database/client";
import type { SessionUser } from "@/features/access/session-user";
import { hasPermission } from "@/features/access/permissions";
import { DrizzleLeadStore, type BrokerLeadFilters, type BrokerLeadScope } from "@/features/leads/drizzle-lead-store";
import { getPublicationPolicyConfig } from "@/features/properties/config";
import { loadMySite } from "./my-site";

/**
 * Escopo dos leads do corretor: site do próprio usuário (resolvido pela sessão) + o próprio usuário.
 * Nenhum ID de site vindo da URL/formulário é aceito. Sem site ou sem permissão → null.
 */
export async function myLeadScope(user: SessionUser): Promise<BrokerLeadScope | null> {
  if (!hasPermission(user, "leads:read-own")) return null;
  const { site } = await loadMySite(user);
  return site ? { brokerSiteId: site.id, brokerUserId: user.id } : null;
}

function store() { return new DrizzleLeadStore(getDatabase(), getPublicationPolicyConfig()); }

export async function listMyLeads(user: SessionUser, filters: BrokerLeadFilters) {
  const scope = await myLeadScope(user);
  return scope ? store().listForBroker(scope, filters) : null;
}

export async function myLeadStats(user: SessionUser, now = new Date()) {
  const scope = await myLeadScope(user);
  return scope ? store().brokerStats(scope, now) : null;
}
