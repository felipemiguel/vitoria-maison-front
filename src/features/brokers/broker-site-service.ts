import { and, asc, count, desc, eq, inArray, max, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminUsers, brokerProfiles, brokerSiteProperties, brokerSites, curatedProperties, mediaAssets, propertySnapshots, userAuditEvents, type BrokerSiteStatus } from "@/database/schema";
import { getPublicationPolicyConfig, type PublicationPolicyConfig } from "@/features/properties/config";
import { publicVisibilityConditions } from "@/features/properties/publication/property-publication-policy";
import { processPresentationImage } from "@/features/media/image-processing";
import { BrokerSiteReadinessService, type BrokerSiteReadiness } from "./broker-site-readiness-service";
import { ForbiddenError } from "@/features/access/errors";
import { hasPermission, type Permission } from "@/features/access/permissions";
import { isUniqueViolation } from "@/features/users/errors";
import type { BrokerActor } from "./broker-profile-service";
import { BrokerConcurrencyError, BrokerError, BrokerSiteNotFoundError } from "./errors";
import { TRANSITIONS, canTransition, type BrokerSiteTransition } from "./status";
import { validateSubdomain } from "./subdomain-rules";
import { brokerSiteContentSchema } from "./validation";

type Db = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type BrokerSiteAction = "read" | "update" | "submit" | "preview" | "approve" | "returnToDraft" | "suspend" | "reactivate" | "manageProperties";
export type BrokerSiteRecord = typeof brokerSites.$inferSelect & { ownerUserId: string; displayName: string };

const OWN_PERMISSION: Partial<Record<BrokerSiteAction, Permission>> = {
  read: "broker-site:read-own", preview: "broker-site:read-own", update: "broker-site:update-own",
  manageProperties: "broker-site:update-own", submit: "broker-site:submit-review",
};
const ADMIN_TRANSITIONS: Record<"approve" | "returnToDraft" | "suspend" | "reactivate", BrokerSiteTransition> = { approve: "APPROVE", returnToDraft: "RETURN_TO_DRAFT", suspend: "SUSPEND", reactivate: "REACTIVATE" };

/**
 * Regra de acesso a um site: permissão + propriedade do recurso.
 * - `broker-site:manage-all` (ADMIN): qualquer site, qualquer ação.
 * - Dono (perfil profissional do próprio usuário): ações "-own" conforme a permissão.
 * - Demais casos: o site é tratado como inexistente (sem revelar que existe).
 * O dono é sempre determinado pelo banco; IDs de perfil/usuário enviados pelo cliente são ignorados.
 */
export function canAccessBrokerSite(actor: BrokerActor, site: { ownerUserId: string }, action: BrokerSiteAction): boolean {
  if (hasPermission(actor, "broker-site:manage-all")) return true;
  const permission = OWN_PERMISSION[action];
  return Boolean(permission) && site.ownerUserId === actor.id && hasPermission(actor, permission!);
}

/** Limites do editor, validados no servidor. */
export const MAX_SELECTED_PROPERTIES = 60;
export const MAX_FEATURED_PROPERTIES = 6;
export const MAX_BULK_ADD = 20;

type ReadinessChecker = { evaluate(siteId: string): Promise<BrokerSiteReadiness | null> };

export type SelectionItem = { curatedPropertyId: string; featured: boolean; sortOrder: number; title: string; vistaCode: string; neighborhood: string | null; city: string | null; coverUrl: string | null; eligible: boolean };

export class BrokerSiteService {
  private readonly policy: PublicationPolicyConfig;
  private readonly readiness: ReadinessChecker;

  constructor(
    private readonly db: Db,
    private readonly imageHosts: string[],
    private readonly revalidate: () => Promise<void> = async () => undefined,
    private readonly now: () => Date = () => new Date(),
    deps: { policy?: PublicationPolicyConfig; readiness?: ReadinessChecker } = {},
  ) {
    this.policy = deps.policy ?? getPublicationPolicyConfig();
    this.readiness = deps.readiness ?? new BrokerSiteReadinessService(db, this.policy, now);
  }

  /** Completude do site (dono ou ADMIN). */
  async getReadiness(actor: BrokerActor, siteId: string): Promise<BrokerSiteReadiness> {
    await this.authorize(actor, siteId, "read");
    const result = await this.readiness.evaluate(siteId);
    if (!result) throw new BrokerSiteNotFoundError();
    return result;
  }

  /** Carrega o site e valida acesso; lança "não encontrado" quando o ator não pode vê-lo. */
  async authorize(actor: BrokerActor, siteId: string, action: BrokerSiteAction, tx: Tx | Db = this.db, lock = false): Promise<BrokerSiteRecord> {
    if (!/^[0-9a-f-]{36}$/i.test(siteId)) throw new BrokerSiteNotFoundError();
    const query = tx.select({ site: brokerSites, ownerUserId: brokerProfiles.userId, displayName: brokerProfiles.displayName })
      .from(brokerSites).innerJoin(brokerProfiles, eq(brokerProfiles.id, brokerSites.brokerProfileId)).where(eq(brokerSites.id, siteId)).limit(1);
    const row = (await (lock ? query.for("update", { of: brokerSites }) : query))[0];
    if (!row || !canAccessBrokerSite(actor, row, action)) throw new BrokerSiteNotFoundError();
    return { ...row.site, ownerUserId: row.ownerUserId, displayName: row.displayName };
  }

  async getOwn(actor: BrokerActor): Promise<BrokerSiteRecord | null> {
    this.assert(actor, "broker-site:read-own");
    const row = (await this.db.select({ site: brokerSites, ownerUserId: brokerProfiles.userId, displayName: brokerProfiles.displayName })
      .from(brokerSites).innerJoin(brokerProfiles, eq(brokerProfiles.id, brokerSites.brokerProfileId)).where(eq(brokerProfiles.userId, actor.id)).limit(1))[0];
    return row ? { ...row.site, ownerUserId: row.ownerUserId, displayName: row.displayName } : null;
  }

  async listAll(actor: BrokerActor, status?: BrokerSiteStatus) {
    this.assert(actor, "broker-site:manage-all");
    return this.db.select({ id: brokerSites.id, subdomain: brokerSites.subdomain, status: brokerSites.status, version: brokerSites.version, displayName: brokerProfiles.displayName, ownerEmail: adminUsers.email, submittedForReviewAt: brokerSites.submittedForReviewAt, publishedAt: brokerSites.publishedAt, updatedAt: brokerSites.updatedAt })
      .from(brokerSites).innerJoin(brokerProfiles, eq(brokerProfiles.id, brokerSites.brokerProfileId)).innerJoin(adminUsers, eq(adminUsers.id, brokerProfiles.userId))
      .where(status ? eq(brokerSites.status, status) : undefined).orderBy(desc(brokerSites.updatedAt)).limit(200);
  }

  /** Cria o site do próprio corretor em rascunho. Um site por perfil; subdomínio único. */
  async createOwn(actor: BrokerActor, input: { subdomain: unknown; headline?: unknown; subtitle?: unknown }): Promise<BrokerSiteRecord> {
    this.assert(actor, "broker-site:create-own");
    const subdomain = validateSubdomain(input.subdomain);
    if (!subdomain.ok) throw new BrokerError(subdomain.message);
    const content = brokerSiteContentSchema(this.imageHosts).parse({ headline: input.headline, subtitle: input.subtitle });
    try {
      const created = await this.db.transaction(async (tx) => {
        const profile = (await tx.select().from(brokerProfiles).where(eq(brokerProfiles.userId, actor.id)).for("update").limit(1))[0];
        if (!profile) throw new BrokerError("Crie seu perfil profissional antes do site.");
        if ((await tx.select({ id: brokerSites.id }).from(brokerSites).where(eq(brokerSites.brokerProfileId, profile.id)).limit(1))[0]) throw new BrokerError("Você já possui um site.");
        const now = this.now();
        const site = (await tx.insert(brokerSites).values({ brokerProfileId: profile.id, subdomain: subdomain.subdomain, status: "DRAFT", headline: content.headline ?? null, subtitle: content.subtitle ?? null, createdAt: now, updatedAt: now }).returning())[0];
        await this.audit(tx, actor.id, actor.id, "BROKER_SITE_CREATED", { siteId: site.id, subdomain: site.subdomain });
        return { ...site, ownerUserId: actor.id, displayName: profile.displayName };
      });
      await this.revalidate();
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) throw new BrokerError(/subdomain/i.test(String((error as { cause?: { constraint?: string } }).cause?.constraint ?? "")) ? "Este endereço já está em uso." : "Este endereço já está em uso ou você já possui um site.");
      throw error;
    }
  }

  /**
   * Conteúdo da página (modelo de edição direta): o dono edita em rascunho e também com o site
   * publicado (alterações auditadas, valem na hora). Em revisão o conteúdo fica congelado para o
   * administrador avaliar exatamente o que foi enviado; suspenso não é editável.
   * O endereço (subdomínio) só muda em rascunho. ADMIN pode editar, exceto sites suspensos.
   */
  async updateContent(actor: BrokerActor, siteId: string, input: { version: unknown; subdomain?: unknown; headline?: unknown; subtitle?: unknown; heroImageUrl?: unknown; introText?: unknown; serviceText?: unknown }): Promise<void> {
    const content = brokerSiteContentSchema(this.imageHosts).parse(input);
    const version = Number(input.version);
    try {
      await this.db.transaction(async (tx) => {
        const site = await this.authorize(actor, siteId, "update", tx, true);
        if (site.version !== version) throw new BrokerConcurrencyError();
        this.assertEditable(actor, site);
        let subdomain = site.subdomain;
        if (input.subdomain !== undefined && input.subdomain !== site.subdomain) {
          if (site.status !== "DRAFT") throw new BrokerError("O endereço só pode ser alterado em rascunho.");
          const validation = validateSubdomain(input.subdomain);
          if (!validation.ok) throw new BrokerError(validation.message);
          subdomain = validation.subdomain;
        }
        // Atualização parcial: campos não enviados são preservados.
        const settings = { ...(site.settings ?? {}), ...(input.introText !== undefined ? { introText: content.introText ?? null } : {}), ...(input.serviceText !== undefined ? { serviceText: content.serviceText ?? null } : {}) };
        await tx.update(brokerSites).set({
          subdomain, settings,
          ...(input.headline !== undefined ? { headline: content.headline ?? null } : {}),
          ...(input.subtitle !== undefined ? { subtitle: content.subtitle ?? null } : {}),
          ...(input.heroImageUrl !== undefined ? { heroImageUrl: content.heroImageUrl ?? null } : {}),
          version: sql`${brokerSites.version} + 1`, updatedAt: this.now(),
        }).where(eq(brokerSites.id, siteId));
        await this.audit(tx, actor.id, site.ownerUserId, "BROKER_SITE_UPDATED", { siteId, status: site.status, ...(subdomain !== site.subdomain ? { from: site.subdomain, to: subdomain } : {}) });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new BrokerError("Este endereço já está em uso.");
      throw error;
    }
    await this.revalidate();
  }

  /** Imagem de apresentação: validada e regravada pelo servidor; a anterior é apagada. */
  async setHeroImage(actor: BrokerActor, siteId: string, input: Buffer): Promise<{ assetId: string }> {
    const image = await processPresentationImage(input);
    const result = await this.db.transaction(async (tx) => {
      const site = await this.authorize(actor, siteId, "update", tx, true);
      this.assertEditable(actor, site);
      const asset = (await tx.insert(mediaAssets).values({ kind: "BROKER_SITE_HERO", ownerUserId: site.ownerUserId, contentType: image.contentType, bytes: image.bytes, sizeBytes: image.sizeBytes, width: image.width, height: image.height, sha256: image.sha256, createdBy: actor.id }).returning({ id: mediaAssets.id }))[0];
      await tx.update(brokerSites).set({ heroImageAssetId: asset.id, heroImageUrl: null, updatedAt: this.now() }).where(eq(brokerSites.id, siteId));
      if (site.heroImageAssetId) await tx.delete(mediaAssets).where(eq(mediaAssets.id, site.heroImageAssetId));
      await this.audit(tx, actor.id, site.ownerUserId, "BROKER_SITE_HERO_UPDATED", { siteId, sizeBytes: image.sizeBytes });
      return { assetId: asset.id };
    });
    await this.revalidate();
    return result;
  }

  async removeHeroImage(actor: BrokerActor, siteId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const site = await this.authorize(actor, siteId, "update", tx, true);
      this.assertEditable(actor, site);
      await tx.update(brokerSites).set({ heroImageAssetId: null, heroImageUrl: null, updatedAt: this.now() }).where(eq(brokerSites.id, siteId));
      if (site.heroImageAssetId) await tx.delete(mediaAssets).where(eq(mediaAssets.id, site.heroImageAssetId));
      await this.audit(tx, actor.id, site.ownerUserId, "BROKER_SITE_HERO_REMOVED", { siteId });
    });
    await this.revalidate();
  }

  /** DRAFT → IN_REVIEW. Exige que todos os critérios de completude estejam cumpridos. */
  async submitForReview(actor: BrokerActor, siteId: string, version: unknown): Promise<void> {
    await this.authorize(actor, siteId, "submit");
    await this.assertReady(siteId, "Complete os itens pendentes antes de solicitar a publicação");
    await this.transition(actor, siteId, version, "submit", "SUBMIT", () => ({ submittedForReviewAt: this.now() }));
  }

  /** IN_REVIEW → PUBLISHED. O ADMIN também não aprova site incompleto. */
  async approve(actor: BrokerActor, siteId: string, version: unknown): Promise<void> {
    await this.authorize(actor, siteId, "approve");
    await this.assertReady(siteId, "O site não cumpre os requisitos mínimos para publicação");
    const now = this.now();
    await this.transition(actor, siteId, version, "approve", ADMIN_TRANSITIONS.approve, () => ({ approvedAt: now, approvedBy: actor.id, publishedAt: now, suspendedAt: null, suspensionReason: null, lastReviewDecision: "APPROVED", lastReviewNotes: null, lastReviewedAt: now, lastReviewedBy: actor.id }));
  }

  /** IN_REVIEW → DRAFT com justificativa obrigatória (não existe estado REJECTED). */
  async returnToDraft(actor: BrokerActor, siteId: string, version: unknown, reason?: unknown): Promise<void> {
    const note = requiredReason(reason, "Informe a justificativa da devolução (mínimo de 10 caracteres).");
    const now = this.now();
    await this.transition(actor, siteId, version, "returnToDraft", ADMIN_TRANSITIONS.returnToDraft, () => ({ submittedForReviewAt: null, lastReviewDecision: "RETURNED", lastReviewNotes: note, lastReviewedAt: now, lastReviewedBy: actor.id }), note);
  }

  async suspend(actor: BrokerActor, siteId: string, version: unknown, reason?: unknown): Promise<void> {
    const note = requiredReason(reason, "Informe o motivo da suspensão (mínimo de 10 caracteres).");
    await this.transition(actor, siteId, version, "suspend", ADMIN_TRANSITIONS.suspend, () => ({ suspendedAt: this.now(), suspensionReason: note }), note);
  }

  /** Reativar volta para rascunho: o site precisa de nova revisão antes de ser publicado. */
  async reactivate(actor: BrokerActor, siteId: string, version: unknown): Promise<void> {
    await this.transition(actor, siteId, version, "reactivate", ADMIN_TRANSITIONS.reactivate, () => ({ suspendedAt: null, suspensionReason: null, approvedAt: null, approvedBy: null, publishedAt: null, submittedForReviewAt: null }));
  }

  /**
   * Adiciona imóveis da curadoria Maison ao site. Só imóveis PUBLICADOS e ELEGÍVEIS (mesmo predicado
   * do catálogo) podem ser selecionados; duplicados são ignorados; limite de imóveis por site.
   * Não copia dados comerciais: grava apenas o vínculo.
   */
  async addProperties(actor: BrokerActor, siteId: string, curatedPropertyIds: string[]): Promise<{ added: number; skipped: number }> {
    const ids = [...new Set(curatedPropertyIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
    if (!ids.length) throw new BrokerError("Selecione ao menos um imóvel.");
    if (ids.length > MAX_BULK_ADD) throw new BrokerError(`Adicione no máximo ${MAX_BULK_ADD} imóveis por vez.`);
    const result = await this.db.transaction(async (tx) => {
      const site = await this.authorize(actor, siteId, "manageProperties", tx, true);
      if (site.status === "SUSPENDED") throw new BrokerError("Site suspenso.");
      const existing = new Set((await tx.select({ id: brokerSiteProperties.curatedPropertyId }).from(brokerSiteProperties).where(eq(brokerSiteProperties.brokerSiteId, siteId))).map((row) => row.id));
      const eligible = await this.eligibleIds(tx, ids);
      const toAdd = ids.filter((id) => eligible.has(id) && !existing.has(id));
      if (ids.some((id) => !eligible.has(id)) && toAdd.length === 0 && ids.every((id) => !existing.has(id))) throw new BrokerError("Imóvel indisponível: somente imóveis publicados e disponíveis na Maison podem ser selecionados.");
      if (existing.size + toAdd.length > MAX_SELECTED_PROPERTIES) throw new BrokerError(`Limite de ${MAX_SELECTED_PROPERTIES} imóveis por site.`);
      const last = (await tx.select({ value: max(brokerSiteProperties.sortOrder) }).from(brokerSiteProperties).where(eq(brokerSiteProperties.brokerSiteId, siteId)))[0]?.value ?? 0;
      if (toAdd.length) await tx.insert(brokerSiteProperties).values(toAdd.map((curatedPropertyId, index) => ({ brokerSiteId: siteId, curatedPropertyId, featured: false, sortOrder: last + index + 1, createdAt: this.now() }))).onConflictDoNothing();
      if (toAdd.length) await this.audit(tx, actor.id, site.ownerUserId, "BROKER_SITE_PROPERTIES_ADDED", { siteId, count: toAdd.length });
      return { added: toAdd.length, skipped: ids.length - toAdd.length };
    });
    if (result.added) await this.revalidate();
    return result;
  }

  async addProperty(actor: BrokerActor, siteId: string, curatedPropertyId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(curatedPropertyId)) throw new BrokerError("Imóvel não encontrado na curadoria.");
    const exists = (await this.db.select({ id: curatedProperties.id }).from(curatedProperties).where(eq(curatedProperties.id, curatedPropertyId)).limit(1))[0];
    if (!exists) { await this.authorize(actor, siteId, "manageProperties"); throw new BrokerError("Imóvel não encontrado na curadoria."); }
    await this.addProperties(actor, siteId, [curatedPropertyId]);
  }

  /** Remove somente a associação; o imóvel continua na curadoria Maison. */
  async removeProperty(actor: BrokerActor, siteId: string, curatedPropertyId: string): Promise<void> {
    const site = await this.authorize(actor, siteId, "manageProperties");
    const removed = await this.db.delete(brokerSiteProperties).where(and(eq(brokerSiteProperties.brokerSiteId, siteId), eq(brokerSiteProperties.curatedPropertyId, curatedPropertyId))).returning({ id: brokerSiteProperties.curatedPropertyId });
    if (removed.length) await this.db.insert(userAuditEvents).values({ actorUserId: actor.id, targetUserId: site.ownerUserId, action: "BROKER_SITE_PROPERTY_REMOVED", metadata: { siteId } });
    await this.revalidate();
  }

  /** Destaque na home: no máximo seis por site, validado sob bloqueio do site. */
  async setFeatured(actor: BrokerActor, siteId: string, curatedPropertyId: string, featured: boolean): Promise<void> {
    await this.db.transaction(async (tx) => {
      const site = await this.authorize(actor, siteId, "manageProperties", tx, true);
      if (site.status === "SUSPENDED") throw new BrokerError("Site suspenso.");
      const item = (await tx.select().from(brokerSiteProperties).where(and(eq(brokerSiteProperties.brokerSiteId, siteId), eq(brokerSiteProperties.curatedPropertyId, curatedPropertyId))).limit(1))[0];
      if (!item) throw new BrokerError("Este imóvel não está na sua seleção.");
      if (item.featured === featured) return;
      if (featured) {
        const total = Number((await tx.select({ total: count() }).from(brokerSiteProperties).where(and(eq(brokerSiteProperties.brokerSiteId, siteId), eq(brokerSiteProperties.featured, true))))[0]?.total ?? 0);
        if (total >= MAX_FEATURED_PROPERTIES) throw new BrokerError(`Você pode destacar no máximo ${MAX_FEATURED_PROPERTIES} imóveis.`);
      }
      await tx.update(brokerSiteProperties).set({ featured }).where(and(eq(brokerSiteProperties.brokerSiteId, siteId), eq(brokerSiteProperties.curatedPropertyId, curatedPropertyId)));
      await this.audit(tx, actor.id, site.ownerUserId, featured ? "BROKER_SITE_PROPERTY_FEATURED" : "BROKER_SITE_PROPERTY_UNFEATURED", { siteId });
    });
    await this.revalidate();
  }

  /**
   * Ordenação independente por site (sort_order). Move dentro do mesmo grupo (destaques ou demais)
   * e renumera a seleção inteira de forma contígua. Não altera a ordem da Maison.
   */
  async moveProperty(actor: BrokerActor, siteId: string, curatedPropertyId: string, direction: "up" | "down"): Promise<void> {
    await this.db.transaction(async (tx) => {
      const site = await this.authorize(actor, siteId, "manageProperties", tx, true);
      if (site.status === "SUSPENDED") throw new BrokerError("Site suspenso.");
      const rows = await tx.select({ id: brokerSiteProperties.curatedPropertyId, featured: brokerSiteProperties.featured, sortOrder: brokerSiteProperties.sortOrder })
        .from(brokerSiteProperties).where(eq(brokerSiteProperties.brokerSiteId, siteId)).orderBy(desc(brokerSiteProperties.featured), asc(brokerSiteProperties.sortOrder), asc(brokerSiteProperties.createdAt));
      const index = rows.findIndex((row) => row.id === curatedPropertyId);
      if (index < 0) throw new BrokerError("Este imóvel não está na sua seleção.");
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= rows.length || rows[target].featured !== rows[index].featured) return;
      [rows[index], rows[target]] = [rows[target], rows[index]];
      for (let position = 0; position < rows.length; position += 1) {
        if (rows[position].sortOrder !== position + 1) await tx.update(brokerSiteProperties).set({ sortOrder: position + 1 }).where(and(eq(brokerSiteProperties.brokerSiteId, siteId), eq(brokerSiteProperties.curatedPropertyId, rows[position].id)));
      }
    });
    await this.revalidate();
  }

  /** Seleção completa (inclusive imóveis que perderam elegibilidade, sinalizados), na ordem pública. */
  async listSelection(actor: BrokerActor, siteId: string): Promise<SelectionItem[]> {
    await this.authorize(actor, siteId, "read");
    const eligible = sql<boolean>`coalesce((${and(...publicVisibilityConditions(this.now(), this.policy))}), false)`;
    const rows = await this.db.select({
      curatedPropertyId: brokerSiteProperties.curatedPropertyId, featured: brokerSiteProperties.featured, sortOrder: brokerSiteProperties.sortOrder,
      editorialTitle: curatedProperties.editorialTitle, sourceTitle: propertySnapshots.sourceTitle, vistaCode: curatedProperties.vistaCode,
      neighborhood: propertySnapshots.neighborhood, city: propertySnapshots.city, editorialCoverUrl: curatedProperties.editorialCoverUrl, coverImageUrl: propertySnapshots.coverImageUrl, eligible,
    }).from(brokerSiteProperties)
      .innerJoin(curatedProperties, eq(curatedProperties.id, brokerSiteProperties.curatedPropertyId))
      .leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(eq(brokerSiteProperties.brokerSiteId, siteId))
      .orderBy(desc(brokerSiteProperties.featured), asc(brokerSiteProperties.sortOrder), asc(brokerSiteProperties.createdAt));
    return rows.map((row) => ({ curatedPropertyId: row.curatedPropertyId, featured: row.featured, sortOrder: row.sortOrder, title: row.editorialTitle ?? row.sourceTitle ?? `Imóvel ${row.vistaCode}`, vistaCode: row.vistaCode, neighborhood: row.neighborhood, city: row.city, coverUrl: row.editorialCoverUrl ?? row.coverImageUrl, eligible: Boolean(row.eligible) }));
  }

  async listAssociations(actor: BrokerActor, siteId: string) {
    await this.authorize(actor, siteId, "read");
    return this.db.select({ curatedPropertyId: brokerSiteProperties.curatedPropertyId, featured: brokerSiteProperties.featured, sortOrder: brokerSiteProperties.sortOrder })
      .from(brokerSiteProperties).where(eq(brokerSiteProperties.brokerSiteId, siteId)).orderBy(asc(brokerSiteProperties.sortOrder));
  }

  private async eligibleIds(tx: Tx | Db, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await tx.select({ id: curatedProperties.id }).from(curatedProperties)
      .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(and(inArray(curatedProperties.id, ids), ...publicVisibilityConditions(this.now(), this.policy)));
    return new Set(rows.map((row) => row.id));
  }

  private async assertReady(siteId: string, prefix: string): Promise<void> {
    const readiness = await this.readiness.evaluate(siteId);
    if (!readiness) throw new BrokerSiteNotFoundError();
    if (!readiness.ready) throw new BrokerError(`${prefix}: ${readiness.missing.join("; ")}.`);
  }

  private assertEditable(actor: BrokerActor, site: BrokerSiteRecord): void {
    if (site.status === "SUSPENDED") throw new BrokerError("Site suspenso: edição indisponível.");
    if (site.status === "IN_REVIEW" && !hasPermission(actor, "broker-site:manage-all")) throw new BrokerError("O site está em revisão. Aguarde a decisão do administrador para editar.");
  }

  private async transition(actor: BrokerActor, siteId: string, rawVersion: unknown, action: BrokerSiteAction, transition: BrokerSiteTransition, changes: (site: BrokerSiteRecord) => Partial<typeof brokerSites.$inferInsert>, reason?: unknown): Promise<void> {
    const version = Number(rawVersion);
    const note = typeof reason === "string" ? reason.trim().slice(0, 500) : undefined;
    await this.db.transaction(async (tx) => {
      const site = await this.authorize(actor, siteId, action, tx, true);
      // Ações administrativas exigem manage-all mesmo que a regra de acesso já tenha passado.
      if (action in ADMIN_TRANSITIONS) this.assert(actor, "broker-site:manage-all");
      if (site.version !== version) throw new BrokerConcurrencyError();
      if (!canTransition(site.status, transition)) throw new BrokerError("Esta mudança de status não é permitida no estado atual.");
      const to = TRANSITIONS[transition].to;
      await tx.update(brokerSites).set({ ...changes(site), status: to, version: sql`${brokerSites.version} + 1`, updatedAt: this.now() }).where(eq(brokerSites.id, siteId));
      await this.audit(tx, actor.id, site.ownerUserId, `BROKER_SITE_${transition}`, { siteId, subdomain: site.subdomain, from: site.status, to, ...(note ? { reason: note } : {}) });
    });
    await this.revalidate();
  }

  private async audit(tx: Tx, actorId: string, ownerUserId: string, action: string, metadata: Record<string, unknown>): Promise<void> {
    await tx.insert(userAuditEvents).values({ actorUserId: actorId, targetUserId: ownerUserId, action, metadata });
  }

  private assert(actor: BrokerActor, permission: Permission): void {
    if (!hasPermission(actor, permission)) throw new ForbiddenError([permission]);
  }
}

function requiredReason(reason: unknown, message: string): string {
  const note = typeof reason === "string" ? reason.trim().replace(/[<>]/g, "").slice(0, 500) : "";
  if (note.length < 10) throw new BrokerError(message);
  return note;
}

