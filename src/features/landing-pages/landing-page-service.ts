import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import * as schema from "@/database/schema";
import { adminAuditEvents, curatedProperties, landingPages, mediaAssets, propertySnapshots, type LandingPageStatus } from "@/database/schema";
import { ForbiddenError } from "@/features/access/errors";
import { hasPermission, type AccessSubject } from "@/features/access/permissions";
import { mediaPath } from "@/features/media/media-url";
import { processLandingHeroImage } from "@/features/media/image-processing";
import type { Property, PropertyRepository } from "@/features/properties/types";
import { contentSchema, defaultContent, parseStoredContent, type LandingContent } from "./blocks";
import { normalizeWhatsappNumber, resolveWhatsappNumber } from "./whatsapp";

type Db = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type LandingActor = AccessSubject & { id: string };

/** Mensagens seguras para exibir no painel. */
export class LandingPageError extends Error { constructor(message: string) { super(message); this.name = "LandingPageError"; } }
export class LandingPageNotFoundError extends LandingPageError { constructor() { super("Landing page não encontrada."); this.name = "LandingPageNotFoundError"; } }
export class LandingPageConcurrencyError extends LandingPageError { constructor() { super("Esta página foi alterada em outra sessão. Recarregue antes de salvar."); this.name = "LandingPageConcurrencyError"; } }

export const LANDING_PAGE_STATUS_LABELS: Record<LandingPageStatus, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicada", ARCHIVED: "Arquivada" };
export type LandingTransition = "publish" | "unpublish" | "archive" | "restore";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugSchema = z.string().trim().toLowerCase().min(3, "O endereço precisa ter pelo menos 3 caracteres.").max(80, "O endereço pode ter no máximo 80 caracteres.").regex(SLUG, "Use só letras minúsculas, números e hífens (ex.: apartamento-moema).");
const version = z.coerce.number().int().min(0);
const optionalText = (max: number, label: string) => z.string().trim().max(max, `${label}: no máximo ${max} caracteres.`).optional().transform((value) => value || null);

const createSchema = z.object({
  name: z.string().trim().min(3, "Dê um nome interno à página (ex.: Campanha Moema – junho).").max(120),
  vistaCode: z.string().trim().min(1, "Informe o código do imóvel no Vista.").max(40).regex(/^[\w.-]+$/, "Código do imóvel inválido."),
  slug: z.string().trim().optional(),
});
const settingsSchema = z.object({
  version,
  name: z.string().trim().min(3, "Dê um nome interno à página.").max(120),
  slug: z.string().optional(),
  whatsappNumber: z.string().trim().max(25).optional().transform((value, ctx) => {
    if (!value) return null;
    const digits = value.replace(/\D/g, "");
    if (!normalizeWhatsappNumber(digits)) { ctx.addIssue({ code: "custom", message: "WhatsApp inválido. Use DDD + número, ex.: 11 99999-9999." }); return z.NEVER; }
    return digits;
  }),
  whatsappMessage: optionalText(300, "Mensagem do WhatsApp"),
  seoTitle: optionalText(70, "Título de compartilhamento"),
  seoDescription: optionalText(170, "Descrição de compartilhamento"),
});

export function slugify(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
}

export type LandingPageRow = typeof landingPages.$inferSelect;
export type LandingPageListItem = { id: string; name: string; slug: string; status: LandingPageStatus; propertyCode: string; propertyTitle: string; propertyVisible: boolean; publishedAt: Date | null; updatedAt: Date };
export type LandingReadiness = { ready: boolean; missing: string[] };
/** Dados de exibição (página pública e prévia). */
export type LandingPageView = { id: string; slug: string; name: string; status: LandingPageStatus; content: LandingContent; heroImageUrl: string | null; whatsappNumber: string | null; whatsappMessage: string | null; seoTitle: string | null; seoDescription: string | null };
export type LandingPageDetail = LandingPageView & { version: number; slugLocked: boolean; pageWhatsappNumber: string | null; heroImageAssetId: string | null; propertyId: string; propertyCode: string; propertyTitle: string; property: Property | null; readiness: LandingReadiness; publishedAt: Date | null; updatedAt: Date };

export class LandingPageService {
  constructor(
    private readonly db: Db,
    private readonly properties: PropertyRepository,
    private readonly options: { defaultWhatsapp?: string | null; now?: () => Date } = {},
  ) {}

  private now(): Date { return this.options.now?.() ?? new Date(); }

  private authorize(actor: LandingActor | null | undefined): asserts actor is LandingActor {
    if (!actor || !hasPermission(actor, "landing-pages:manage")) throw new ForbiddenError(["landing-pages:manage"]);
  }

  /** Imóvel exibível: mesmo predicado público do catálogo (publicado, elegível, snapshot recente). */
  private async visibleProperty(curatedPropertyId: string): Promise<Property | null> {
    return (await this.properties.list({ ids: [curatedPropertyId], pageSize: 1 })).items[0] ?? null;
  }

  async list(actor: LandingActor): Promise<LandingPageListItem[]> {
    this.authorize(actor);
    const rows = await this.db.select({
      id: landingPages.id, name: landingPages.name, slug: landingPages.slug, status: landingPages.status, publishedAt: landingPages.publishedAt, updatedAt: landingPages.updatedAt,
      propertyId: landingPages.curatedPropertyId, propertyCode: curatedProperties.vistaCode,
      propertyTitle: sql<string>`COALESCE(NULLIF(BTRIM(${curatedProperties.editorialTitle}), ''), ${propertySnapshots.sourceTitle}, ${curatedProperties.vistaCode})`,
    }).from(landingPages)
      .innerJoin(curatedProperties, eq(curatedProperties.id, landingPages.curatedPropertyId))
      .leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .orderBy(desc(landingPages.updatedAt)).limit(200);
    const ids = [...new Set(rows.map((row) => row.propertyId))];
    const visible = new Set<string>();
    for (let index = 0; index < ids.length; index += 50) {
      for (const item of (await this.properties.list({ ids: ids.slice(index, index + 50), pageSize: 50 })).items) visible.add(item.id);
    }
    return rows.map(({ propertyId, ...row }) => ({ ...row, propertyVisible: visible.has(propertyId) }));
  }

  async create(actor: LandingActor, raw: unknown): Promise<{ id: string }> {
    this.authorize(actor);
    const input = createSchema.parse(raw);
    const property = (await this.properties.list({ vistaCode: input.vistaCode, pageSize: 1 })).items[0];
    if (!property) throw new LandingPageError("Imóvel não encontrado entre os publicados no site. Confira o código e se o imóvel está visível no catálogo.");
    const slug = slugSchema.parse(input.slug?.trim() ? input.slug : slugify(property.slug.startsWith("vista-") ? `${property.location.neighborhood}-${property.commercial.code}` : property.slug));
    const content = defaultContent(property);
    return this.unique(async () => this.db.transaction(async (tx) => {
      const row = (await tx.insert(landingPages).values({ slug, name: input.name, curatedPropertyId: property.id, content, createdBy: actor.id, updatedBy: actor.id }).returning({ id: landingPages.id }))[0];
      await this.audit(tx, actor.id, row.id, "LANDING_PAGE_CREATED", {}, { slug, propertyCode: property.commercial.code });
      return row;
    }));
  }

  async get(actor: LandingActor, id: string): Promise<LandingPageDetail> {
    this.authorize(actor);
    const row = await this.load(this.db, id);
    const meta = (await this.db.select({
      code: curatedProperties.vistaCode,
      title: sql<string>`COALESCE(NULLIF(BTRIM(${curatedProperties.editorialTitle}), ''), ${propertySnapshots.sourceTitle}, ${curatedProperties.vistaCode})`,
    }).from(curatedProperties).leftJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id)).where(eq(curatedProperties.id, row.curatedPropertyId)).limit(1))[0];
    const property = await this.visibleProperty(row.curatedPropertyId);
    const view = this.toView(row);
    return {
      ...view, version: row.version, slugLocked: row.firstPublishedAt !== null, pageWhatsappNumber: row.whatsappNumber, heroImageAssetId: row.heroImageAssetId,
      propertyId: row.curatedPropertyId, propertyCode: meta?.code ?? "", propertyTitle: meta?.title ?? "", property,
      readiness: this.readiness(view, property), publishedAt: row.publishedAt, updatedAt: row.updatedAt,
    };
  }

  /** Requisitos para publicar: imóvel visível no catálogo, topo com título e WhatsApp válido. */
  readiness(view: Pick<LandingPageView, "content" | "whatsappNumber">, property: Property | null): LandingReadiness {
    const missing: string[] = [];
    if (!property) missing.push("O imóvel não está visível no catálogo público (publicação, disponibilidade ou sincronização do Vista).");
    const hero = view.content.blocks[0];
    if (!hero || hero.type !== "hero" || !hero.enabled || !hero.title.trim()) missing.push("Preencha e ative o bloco de topo com um título.");
    if (!view.whatsappNumber) missing.push("Defina o WhatsApp da página (ou NEXT_PUBLIC_WHATSAPP_NUMBER no ambiente).");
    return { ready: missing.length === 0, missing };
  }

  async updateSettings(actor: LandingActor, id: string, raw: unknown): Promise<void> {
    this.authorize(actor);
    const input = settingsSchema.parse(raw);
    await this.unique(() => this.db.transaction(async (tx) => {
      const current = await this.load(tx, id, true);
      this.assertVersion(current, input.version);
      if (current.status === "ARCHIVED") throw new LandingPageError("Restaure a página antes de editar.");
      // O endereço fica travado após a primeira publicação: links já usados em anúncios não podem quebrar.
      const slug = current.firstPublishedAt || input.slug === undefined ? current.slug : slugSchema.parse(input.slug);
      await tx.update(landingPages).set({ name: input.name, slug, whatsappNumber: input.whatsappNumber, whatsappMessage: input.whatsappMessage, seoTitle: input.seoTitle, seoDescription: input.seoDescription, version: current.version + 1, updatedBy: actor.id, updatedAt: this.now() }).where(eq(landingPages.id, id));
      await this.audit(tx, actor.id, id, "LANDING_PAGE_SETTINGS_UPDATED", { slug: current.slug }, { slug });
    }));
  }

  async updateContent(actor: LandingActor, id: string, rawVersion: unknown, rawContent: unknown): Promise<void> {
    this.authorize(actor);
    const expected = version.parse(rawVersion);
    let decoded: unknown = rawContent;
    if (typeof rawContent === "string") {
      if (rawContent.length > 200_000) throw new LandingPageError("Conteúdo grande demais.");
      try { decoded = JSON.parse(rawContent); } catch { throw new LandingPageError("Conteúdo inválido. Recarregue a página."); }
    }
    const content = contentSchema.parse(decoded);
    await this.db.transaction(async (tx) => {
      const current = await this.load(tx, id, true);
      this.assertVersion(current, expected);
      if (current.status === "ARCHIVED") throw new LandingPageError("Restaure a página antes de editar.");
      // Página publicada continua precisando de topo com título.
      if (current.status === "PUBLISHED") {
        const hero = content.blocks[0];
        if (!hero || hero.type !== "hero" || !hero.enabled || !hero.title.trim()) throw new LandingPageError("Uma página publicada precisa do bloco de topo ativo e com título.");
      }
      await tx.update(landingPages).set({ content, version: current.version + 1, updatedBy: actor.id, updatedAt: this.now() }).where(eq(landingPages.id, id));
      await this.audit(tx, actor.id, id, "LANDING_PAGE_CONTENT_UPDATED", {}, { blocks: content.blocks.length });
    });
  }

  async transition(actor: LandingActor, id: string, rawVersion: unknown, operation: LandingTransition): Promise<void> {
    this.authorize(actor);
    const expected = version.parse(rawVersion);
    const allowed: Record<LandingTransition, { from: LandingPageStatus[]; to: LandingPageStatus }> = {
      publish: { from: ["DRAFT"], to: "PUBLISHED" }, unpublish: { from: ["PUBLISHED"], to: "DRAFT" },
      archive: { from: ["DRAFT", "PUBLISHED"], to: "ARCHIVED" }, restore: { from: ["ARCHIVED"], to: "DRAFT" },
    };
    const rule = allowed[operation];
    if (!rule) throw new LandingPageError("Operação inválida.");
    const current = await this.load(this.db, id);
    this.assertVersion(current, expected);
    if (!rule.from.includes(current.status)) throw new LandingPageError("Esta ação não está disponível no status atual.");
    if (operation === "publish") {
      const readiness = this.readiness(this.toView(current), await this.visibleProperty(current.curatedPropertyId));
      if (!readiness.ready) throw new LandingPageError(`Antes de publicar: ${readiness.missing.join(" ")}`);
    }
    const now = this.now();
    await this.db.transaction(async (tx) => {
      const patch = operation === "publish" ? { publishedAt: now, publishedBy: actor.id, firstPublishedAt: current.firstPublishedAt ?? now } : { publishedAt: null };
      const updated = await tx.update(landingPages).set({ ...patch, status: rule.to, version: current.version + 1, updatedBy: actor.id, updatedAt: now })
        .where(and(eq(landingPages.id, id), eq(landingPages.version, current.version))).returning({ id: landingPages.id });
      if (!updated.length) throw new LandingPageConcurrencyError();
      await this.audit(tx, actor.id, id, `LANDING_PAGE_${operation.toUpperCase()}`, { status: current.status }, { status: rule.to });
    });
  }

  /** Cópia em rascunho, com novo endereço (ex.: para testar outro texto de campanha). */
  async duplicate(actor: LandingActor, id: string): Promise<{ id: string }> {
    this.authorize(actor);
    const source = await this.load(this.db, id);
    const base = `${source.slug.replace(/-copia(?:-\d+)?$/, "").slice(0, 66)}-copia`;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const slug = attempt === 1 ? base : `${base}-${attempt}`;
      try {
        return await this.db.transaction(async (tx) => {
          const row = (await tx.insert(landingPages).values({
            slug, name: `${source.name} (cópia)`.slice(0, 120), curatedPropertyId: source.curatedPropertyId, content: source.content,
            whatsappNumber: source.whatsappNumber, whatsappMessage: source.whatsappMessage, seoTitle: source.seoTitle, seoDescription: source.seoDescription,
            createdBy: actor.id, updatedBy: actor.id,
          }).returning({ id: landingPages.id }))[0];
          await this.audit(tx, actor.id, row.id, "LANDING_PAGE_DUPLICATED", {}, { from: source.id, slug });
          return row;
        });
      } catch (error) { if (!isUniqueViolation(error)) throw error; }
    }
    throw new LandingPageError("Não foi possível gerar um endereço livre para a cópia.");
  }

  async setHeroImage(actor: LandingActor, id: string, input: Buffer): Promise<void> {
    this.authorize(actor);
    const image = await processLandingHeroImage(input);
    await this.db.transaction(async (tx) => {
      const current = await this.load(tx, id, true);
      if (current.status === "ARCHIVED") throw new LandingPageError("Restaure a página antes de editar.");
      const asset = (await tx.insert(mediaAssets).values({ kind: "LANDING_PAGE_HERO", ownerUserId: actor.id, contentType: image.contentType, bytes: image.bytes, sizeBytes: image.sizeBytes, width: image.width, height: image.height, sha256: image.sha256, createdBy: actor.id }).returning({ id: mediaAssets.id }))[0];
      await tx.update(landingPages).set({ heroImageAssetId: asset.id, version: current.version + 1, updatedBy: actor.id, updatedAt: this.now() }).where(eq(landingPages.id, id));
      if (current.heroImageAssetId) await this.deleteAssetIfUnused(tx, current.heroImageAssetId, id);
      await this.audit(tx, actor.id, id, "LANDING_PAGE_HERO_UPDATED", {}, { sizeBytes: image.sizeBytes });
    });
  }

  async removeHeroImage(actor: LandingActor, id: string): Promise<void> {
    this.authorize(actor);
    await this.db.transaction(async (tx) => {
      const current = await this.load(tx, id, true);
      if (!current.heroImageAssetId) return;
      await tx.update(landingPages).set({ heroImageAssetId: null, version: current.version + 1, updatedBy: actor.id, updatedAt: this.now() }).where(eq(landingPages.id, id));
      await this.deleteAssetIfUnused(tx, current.heroImageAssetId, id);
      await this.audit(tx, actor.id, id, "LANDING_PAGE_HERO_REMOVED", {}, {});
    });
  }

  /** Leitura pública: só PUBLICADA. O imóvel pode ter saído do catálogo (property = null). */
  async findPublished(slug: string): Promise<{ page: LandingPageView; property: Property | null } | null> {
    if (!SLUG.test(slug) || slug.length > 80) return null;
    const row = (await this.db.select().from(landingPages).where(and(eq(landingPages.slug, slug), eq(landingPages.status, "PUBLISHED"))).limit(1))[0];
    if (!row) return null;
    return { page: this.toView(row), property: await this.visibleProperty(row.curatedPropertyId) };
  }

  /** Prévia autenticada: qualquer status. */
  async findForPreview(actor: LandingActor, id: string): Promise<{ page: LandingPageView; property: Property | null }> {
    this.authorize(actor);
    const row = await this.load(this.db, id);
    return { page: this.toView(row), property: await this.visibleProperty(row.curatedPropertyId) };
  }

  private toView(row: LandingPageRow): LandingPageView {
    return {
      id: row.id, slug: row.slug, name: row.name, status: row.status, content: parseStoredContent(row.content),
      heroImageUrl: row.heroImageAssetId ? mediaPath(row.heroImageAssetId) : null,
      whatsappNumber: resolveWhatsappNumber(row.whatsappNumber, this.options.defaultWhatsapp), whatsappMessage: row.whatsappMessage,
      seoTitle: row.seoTitle, seoDescription: row.seoDescription,
    };
  }

  private async load(db: Db | Tx, id: string, lock = false): Promise<LandingPageRow> {
    if (!z.uuid().safeParse(id).success) throw new LandingPageNotFoundError();
    const query = db.select().from(landingPages).where(eq(landingPages.id, id)).limit(1);
    const row = (lock ? await query.for("update") : await query)[0];
    if (!row) throw new LandingPageNotFoundError();
    return row;
  }

  private assertVersion(row: LandingPageRow, expected: number): void {
    if (row.version !== expected) throw new LandingPageConcurrencyError();
  }

  private async deleteAssetIfUnused(tx: Tx, assetId: string, exceptPageId: string): Promise<void> {
    // Cópias compartilham o conteúdo, mas não a imagem enviada (duplicate não copia o asset).
    const inUse = await tx.select({ id: landingPages.id }).from(landingPages).where(and(eq(landingPages.heroImageAssetId, assetId), sql`${landingPages.id} <> ${exceptPageId}`)).limit(1);
    if (!inUse.length) await tx.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
  }

  private async unique<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) {
      if (isUniqueViolation(error)) throw new LandingPageError("Este endereço já está em uso por outra landing page.");
      throw error;
    }
  }

  private async audit(tx: Tx, actorId: string, entityId: string, action: string, beforeState: Record<string, unknown>, afterState: Record<string, unknown>): Promise<void> {
    await tx.insert(adminAuditEvents).values({ adminUserId: actorId, entityType: "LANDING_PAGE", entityId, action, beforeState, afterState });
  }
}

function isUniqueViolation(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && typeof current === "object" && depth < 5; current = (current as { cause?: unknown }).cause, depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
