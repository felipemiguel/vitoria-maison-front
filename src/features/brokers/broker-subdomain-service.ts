import { and, eq, inArray, ne } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { brokerSites } from "@/database/schema";
import type { BrokerSitesConfig } from "./config";
import { brokerSiteUrl } from "./hosts";
import { subdomainCandidates, validateSubdomain } from "./subdomain-rules";

type Db = NodePgDatabase<typeof schema>;

export type SubdomainAvailability =
  | { available: true; subdomain: string; publicUrl: string | null }
  | { available: false; message: string; suggestions: string[] };

/**
 * Validação, disponibilidade e resolução de subdomínios. A reserva definitiva é garantida pelo
 * índice único no banco no momento da criação do site (sem condição de corrida).
 */
export class BrokerSubdomainService {
  constructor(private readonly db: Db, private readonly config: Pick<BrokerSitesConfig, "baseDomain" | "protocol" | "port">) {}

  async checkAvailability(raw: unknown, excludeSiteId?: string): Promise<SubdomainAvailability> {
    const validation = validateSubdomain(raw);
    if (!validation.ok) return { available: false, message: validation.message, suggestions: typeof raw === "string" && validation.problem !== "RESERVED" ? await this.suggest(raw) : [] };
    if (await this.isTaken(validation.subdomain, excludeSiteId)) return { available: false, message: "Este endereço já está em uso.", suggestions: await this.suggest(validation.subdomain) };
    return { available: true, subdomain: validation.subdomain, publicUrl: this.publicUrl(validation.subdomain) };
  }

  /** Sugestões livres a partir de um nome, resolvendo conflitos com sufixos numéricos. */
  async suggest(name: string, limit = 3): Promise<string[]> {
    const candidates = subdomainCandidates(name, 8);
    if (!candidates.length) return [];
    const taken = new Set((await this.db.select({ subdomain: brokerSites.subdomain }).from(brokerSites).where(inArray(brokerSites.subdomain, candidates))).map((row) => row.subdomain));
    return candidates.filter((candidate) => !taken.has(candidate)).slice(0, limit);
  }

  async isTaken(subdomain: string, excludeSiteId?: string): Promise<boolean> {
    const rows = await this.db.select({ id: brokerSites.id }).from(brokerSites)
      .where(excludeSiteId ? and(eq(brokerSites.subdomain, subdomain), ne(brokerSites.id, excludeSiteId)) : eq(brokerSites.subdomain, subdomain)).limit(1);
    return rows.length > 0;
  }

  publicUrl(subdomain: string): string | null { return brokerSiteUrl(subdomain, this.config); }
}
