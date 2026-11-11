import { cache } from "react";
import type { SessionUser } from "@/features/access/session-user";
import { createBrokerServices } from "./factory";

/** Dados do próprio site do usuário (deduplicado por requisição entre layout e páginas). */
export const loadMySite = cache(async (user: SessionUser) => {
  const { profiles, sites } = createBrokerServices();
  const [profile, site] = await Promise.all([profiles.getOwn(user), sites.getOwn(user)]);
  const [readiness, selection] = site ? await Promise.all([sites.getReadiness(user, site.id), sites.listSelection(user, site.id)]) : [null, []];
  return { profile, site, readiness, selection };
});
