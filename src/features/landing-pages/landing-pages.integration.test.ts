import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, like, sql } from "drizzle-orm";
import sharp from "sharp";
import * as schema from "@/database/schema";
import { adminAuditEvents, adminUsers, curatedProperties, landingPages, mediaAssets, propertySnapshots } from "@/database/schema";
import { ForbiddenError } from "@/features/access/errors";
import { findPublicMedia } from "@/features/media/media-service";
import { DatabasePropertyRepository } from "@/features/properties/repositories/database-property-repository";
import { LandingPageConcurrencyError, LandingPageService } from "./landing-page-service";

/**
 * Integração com PostgreSQL real (banco de TESTE migrado). Dados fictícios: usuários @landing.local
 * e imóveis com código "LPT-*"; somente eles são apagados entre os testes.
 */
const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration("landing pages (PostgreSQL)", () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  const db = drizzle(pool, { schema });
  const properties = new DatabasePropertyRepository(db, { defaultState: "SP", confirmationTtlDays: 7, snapshotMaxAgeHours: 48 });
  const service = new LandingPageService(db, properties, { defaultWhatsapp: "11 3085-1381" });
  const noWhatsapp = new LandingPageService(db, properties, { defaultWhatsapp: "" });
  let counter = 0;

  afterAll(async () => pool.end());
  beforeEach(async () => {
    await db.execute(sql`delete from landing_pages where curated_property_id in (select id from curated_properties where vista_code like 'LPT-%')`);
    await db.delete(mediaAssets).where(eq(mediaAssets.kind, "LANDING_PAGE_HERO"));
    await db.delete(curatedProperties).where(like(curatedProperties.vistaCode, "LPT-%"));
    await db.execute(sql`delete from admin_audit_events where admin_user_id in (select id from admin_users where email like '%@landing.local')`);
    await db.delete(adminUsers).where(like(adminUsers.email, "%@landing.local"));
  });

  async function actor(roles: string[]) {
    counter += 1;
    const row = (await db.insert(adminUsers).values({ name: `Usuário ${counter}`, email: `u${counter}-${Date.now()}@landing.local`, passwordHash: "x", active: true }).returning())[0];
    return { id: row.id, active: true, roles };
  }
  async function property(published = true) {
    counter += 1;
    const code = `LPT-${counter}-${Date.now()}`;
    const curated = (await db.insert(curatedProperties).values({ vistaCode: code, slug: `lpt-${counter}-${Date.now()}`, published, publicationPurpose: "SALE" }).returning())[0];
    await db.insert(propertySnapshots).values({ curatedPropertyId: curated.id, externalCode: code, category: "APARTMENT", city: "São Paulo", neighborhood: "Moema", salePrice: "900000", privateArea: "60", sourceTitle: "Apartamento fictício", coverImageUrl: "https://fotos.teste.local/1.jpg", availabilityStatus: "AVAILABLE", fetchedAt: new Date() });
    return curated;
  }

  it("cria com template preenchido; exige imóvel visível no catálogo", async () => {
    const manager = await actor(["MANAGER"]);
    const visible = await property();
    const { id } = await service.create(manager, { name: "Campanha Moema", vistaCode: visible.vistaCode, slug: "apto-moema-teste" });
    const page = await service.get(manager, id);
    expect(page).toMatchObject({ status: "DRAFT", slug: "apto-moema-teste", slugLocked: false, propertyCode: visible.vistaCode });
    expect(page.content.blocks[0]).toMatchObject({ type: "hero", title: "Apartamento fictício" });
    expect(page.readiness.ready).toBe(true);
    const hidden = await property(false);
    await expect(service.create(manager, { name: "Oculto", vistaCode: hidden.vistaCode })).rejects.toThrow(/não encontrado entre os publicados/);
    await expect(service.create(manager, { name: "Repetida", vistaCode: visible.vistaCode, slug: "apto-moema-teste" })).rejects.toThrow(/já está em uso/);
  });

  it("BROKER e usuário inativo não acessam", async () => {
    const broker = await actor(["BROKER"]);
    const visible = await property();
    await expect(service.create(broker, { name: "Teste", vistaCode: visible.vistaCode })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.list({ id: broker.id, active: false, roles: ["ADMIN"] })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("público vê só PUBLICADA; endereço trava após a primeira publicação", async () => {
    const admin = await actor(["ADMIN"]);
    const visible = await property();
    const { id } = await service.create(admin, { name: "Campanha", vistaCode: visible.vistaCode, slug: "lp-publica-teste" });
    expect(await service.findPublished("lp-publica-teste")).toBeNull();
    await service.transition(admin, id, 0, "publish");
    const found = await service.findPublished("lp-publica-teste");
    expect(found?.page.status).toBe("PUBLISHED");
    expect(found?.property?.commercial.code).toBe(visible.vistaCode);
    expect(found?.page.whatsappNumber).toBe("551130851381");
    await service.updateSettings(admin, id, { version: 1, name: "Campanha 2", slug: "outro-endereco" });
    expect((await service.get(admin, id))).toMatchObject({ slug: "lp-publica-teste", name: "Campanha 2", slugLocked: true });
    await service.transition(admin, id, 2, "unpublish");
    expect(await service.findPublished("lp-publica-teste")).toBeNull();
    await service.transition(admin, id, 3, "archive");
    await expect(service.updateContent(admin, id, 4, (await service.get(admin, id)).content)).rejects.toThrow(/Restaure/);
    expect(await service.findPublished("lp-publica-teste")).toBeNull();
    const actions = (await db.select({ action: adminAuditEvents.action }).from(adminAuditEvents).where(and(eq(adminAuditEvents.entityType, "LANDING_PAGE"), eq(adminAuditEvents.entityId, id)))).map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(["LANDING_PAGE_CREATED", "LANDING_PAGE_PUBLISH", "LANDING_PAGE_SETTINGS_UPDATED", "LANDING_PAGE_UNPUBLISH", "LANDING_PAGE_ARCHIVE"]));
  });

  it("não publica sem WhatsApp nem com o topo desativado", async () => {
    const admin = await actor(["ADMIN"]);
    const visible = await property();
    const { id } = await noWhatsapp.create(admin, { name: "Sem número", vistaCode: visible.vistaCode, slug: "lp-sem-numero" });
    await expect(noWhatsapp.transition(admin, id, 0, "publish")).rejects.toThrow(/WhatsApp/);
    await noWhatsapp.updateSettings(admin, id, { version: 0, name: "Com número", whatsappNumber: "11 98888-7777" });
    const page = await noWhatsapp.get(admin, id);
    await noWhatsapp.updateContent(admin, id, 1, { blocks: page.content.blocks.map((block) => block.type === "hero" ? { ...block, enabled: false } : block) });
    await expect(noWhatsapp.transition(admin, id, 2, "publish")).rejects.toThrow(/bloco de topo/);
  });

  it("imóvel que sai do catálogo: página publicada continua, sem dados do imóvel", async () => {
    const admin = await actor(["ADMIN"]);
    const visible = await property();
    const { id } = await service.create(admin, { name: "Campanha", vistaCode: visible.vistaCode, slug: "lp-indisponivel" });
    await service.transition(admin, id, 0, "publish");
    await db.update(curatedProperties).set({ published: false }).where(eq(curatedProperties.id, visible.id));
    const found = await service.findPublished("lp-indisponivel");
    expect(found?.property).toBeNull();
    expect((await service.list(admin)).find((item) => item.id === id)).toMatchObject({ propertyVisible: false, status: "PUBLISHED" });
    expect((await service.get(admin, id)).readiness.ready).toBe(false);
  });

  it("versão desatualizada é recusada; conteúdo inválido não é gravado", async () => {
    const admin = await actor(["ADMIN"]);
    const visible = await property();
    const { id } = await service.create(admin, { name: "Campanha", vistaCode: visible.vistaCode, slug: "lp-versao" });
    const page = await service.get(admin, id);
    await service.updateContent(admin, id, 0, JSON.stringify(page.content));
    await expect(service.updateContent(admin, id, 0, page.content)).rejects.toBeInstanceOf(LandingPageConcurrencyError);
    await expect(service.updateContent(admin, id, 1, "{not json")).rejects.toThrow(/inválido/);
    await expect(service.updateContent(admin, id, 1, { blocks: [{ id: "abcd1", enabled: true, type: "html" }] })).rejects.toThrow();
    expect((await service.get(admin, id)).version).toBe(1);
  });

  it("duplica em rascunho com endereço livre; imagem de topo é pública e trocada sem deixar órfãs", async () => {
    const admin = await actor(["ADMIN"]);
    const visible = await property();
    const { id } = await service.create(admin, { name: "Original", vistaCode: visible.vistaCode, slug: "lp-original" });
    await service.transition(admin, id, 0, "publish");
    const first = await service.duplicate(admin, id);
    const second = await service.duplicate(admin, id);
    expect((await service.get(admin, first.id))).toMatchObject({ slug: "lp-original-copia", status: "DRAFT", name: "Original (cópia)" });
    expect((await service.get(admin, second.id)).slug).toBe("lp-original-copia-2");
    const image = await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 90, g: 30, b: 50 } } }).jpeg().toBuffer();
    await service.setHeroImage(admin, id, image);
    const withHero = await service.get(admin, id);
    expect(withHero.heroImageUrl).toMatch(/^\/media\//);
    const asset = await findPublicMedia(db, withHero.heroImageAssetId!);
    expect(asset?.contentType).toBe("image/webp");
    expect((await sharp(asset!.bytes).metadata())).toMatchObject({ width: 1920, height: 1080 });
    await service.setHeroImage(admin, id, image);
    expect(await db.select().from(mediaAssets).where(eq(mediaAssets.kind, "LANDING_PAGE_HERO"))).toHaveLength(1);
    await service.removeHeroImage(admin, id);
    expect(await db.select().from(mediaAssets).where(eq(mediaAssets.kind, "LANDING_PAGE_HERO"))).toHaveLength(0);
    expect((await db.select().from(landingPages).where(eq(landingPages.id, id)))[0].heroImageAssetId).toBeNull();
  });
});
