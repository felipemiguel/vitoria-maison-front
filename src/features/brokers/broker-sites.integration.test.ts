import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, like, sql } from "drizzle-orm";
import * as schema from "@/database/schema";
import { adminUsers, brokerProfiles, brokerSites, curatedProperties, mediaAssets, propertySnapshots, roles, userRoles } from "@/database/schema";
import sharp from "sharp";
import { findPublicMedia } from "@/features/media/media-service";
import { findSiteViewById } from "./public-site-service";
import { loadSessionUser } from "@/features/access/session-user";
import { ForbiddenError } from "@/features/access/errors";
import type { RoleCode } from "@/features/access/permissions";
import { DatabasePropertyRepository } from "@/features/properties/repositories/database-property-repository";
import { BrokerProfileService } from "./broker-profile-service";
import { BrokerSiteService } from "./broker-site-service";
import { BrokerSubdomainService } from "./broker-subdomain-service";
import { BrokerSitePropertyRepository } from "./broker-site-property-repository";
import { findPublishedSiteBySubdomain } from "./public-site-service";
import { BrokerError, BrokerSiteNotFoundError } from "./errors";
import { vi } from "vitest";
import { MAX_SELECTED_PROPERTIES } from "./broker-site-service";

/**
 * Integração com PostgreSQL real (banco de TESTE migrado). Dados fictícios @brokers.local e
 * imóveis com código "BRK-*"; somente eles são apagados entre os testes.
 */
const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration("sites de corretores (PostgreSQL)", () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  const db = drizzle(pool, { schema });
  const hosts = ["fotos.teste.local"];
  const profiles = new BrokerProfileService(db, hosts);
  const policy = { defaultState: "SP", confirmationTtlDays: 7, snapshotMaxAgeHours: 48 };
  // `sites`: completude sempre atendida (testes de fluxo/isolamento). `strictSites`: completude real (6.4C).
  const permissiveReadiness = { evaluate: async () => ({ ready: true, completed: 8, total: 8, missing: [], items: [] }) };
  const revalidate = vi.fn(async () => undefined);
  const sites = new BrokerSiteService(db, hosts, revalidate, undefined, { policy, readiness: permissiveReadiness });
  const strictSites = new BrokerSiteService(db, hosts, revalidate, undefined, { policy });
  const subdomains = new BrokerSubdomainService(db, { baseDomain: "maison.localhost", protocol: "http", port: "3000" });
  const siteProperties = new BrokerSitePropertyRepository(new DatabasePropertyRepository(db, { defaultState: "SP", confirmationTtlDays: 7, snapshotMaxAgeHours: 48 }));
  let counter = 0;

  afterAll(async () => pool.end());
  beforeEach(async () => {
    await db.execute(sql`truncate table lead_delivery_attempts, lead_submissions, broker_site_properties, broker_sites, broker_profiles, media_assets, user_audit_events`);
    await db.delete(curatedProperties).where(like(curatedProperties.vistaCode, "BRK-%"));
    await db.execute(sql`truncate table user_roles`);
    await db.delete(adminUsers).where(like(adminUsers.email, "%@brokers.local"));
  });

  async function user(name: string, roleCodes: RoleCode[], active = true) {
    const row = (await db.insert(adminUsers).values({ name, email: `${name.toLowerCase().replace(/\W+/g, ".")}@brokers.local`, passwordHash: "x", active }).returning())[0];
    for (const code of roleCodes) await db.insert(userRoles).values({ userId: row.id, roleId: (await db.select().from(roles).where(eq(roles.code, code)))[0].id });
    return (await loadSessionUser(db, row.id, 0)) ?? { id: row.id, active: false as const, roles: roleCodes };
  }
  async function broker(name: string, subdomain: string, extraRoles: RoleCode[] = []) {
    const actor = await user(name, ["BROKER", ...extraRoles]);
    await profiles.createOwn(actor as never, { displayName: name });
    const site = await sites.createOwn(actor as never, { subdomain, headline: `Imóveis com ${name}` });
    return { actor, site };
  }
  async function property(published = true) {
    counter += 1;
    const curated = (await db.insert(curatedProperties).values({ vistaCode: `BRK-${counter}-${Date.now()}`, slug: `brk-${counter}-${Date.now()}`, published, publicationPurpose: "SALE" }).returning())[0];
    await db.insert(propertySnapshots).values({ curatedPropertyId: curated.id, externalCode: curated.vistaCode, category: "APARTMENT", city: "São Paulo", neighborhood: "Moema", salePrice: "900000", privateArea: "60", sourceTitle: "Apartamento fictício", coverImageUrl: "https://fotos.teste.local/1.jpg", availabilityStatus: "AVAILABLE", fetchedAt: new Date() });
    return curated;
  }
  const admin = () => user("Admin Sites", ["ADMIN"]);

  describe("perfil profissional", () => {
    it("BROKER cria o próprio perfil; usuário sem BROKER não", async () => {
      const ana = await user("Ana Corretora", ["BROKER"]);
      const created = await profiles.createOwn(ana as never, { displayName: "Ana Corretora", creci: "123456-f/sp", vistaBrokerCode: "77", specialties: ["Flats", "Flats"] });
      expect(created).toMatchObject({ creci: "123456-F/SP", vistaBrokerCode: null, creciVerifiedAt: null, vistaBrokerCodeVerifiedAt: null, specialties: ["Flats"] });
      const manager = await user("Gestor Puro", ["MANAGER"]);
      await expect(profiles.createOwn(manager as never, { displayName: "Gestor" })).rejects.toBeInstanceOf(ForbiddenError);
      const adm = await admin();
      await expect(profiles.createForUser(adm as never, manager.id, { displayName: "Gestor" })).rejects.toThrow(/perfil Corretor/);
    });

    it("MANAGER + BROKER usa os dois conjuntos de permissões; perfil é único por usuário", async () => {
      const both = await user("Gestora Corretora", ["MANAGER", "BROKER"]);
      await profiles.createOwn(both as never, { displayName: "Gestora" });
      await expect(profiles.createOwn(both as never, { displayName: "De novo" })).rejects.toThrow(/já possui/);
    });

    it("código do Vista: somente ADMIN configura; o corretor não altera (valor enviado é ignorado)", async () => {
      const ana = await user("Ana Vista", ["BROKER"]);
      const profile = await profiles.createOwn(ana as never, { displayName: "Ana", vistaBrokerCode: "10" });
      expect(profile.vistaBrokerCode).toBeNull();
      const adm = await admin();
      await profiles.setVistaBrokerCode(adm as never, profile.id, "77");
      expect(await profiles.getOwn(ana as never)).toMatchObject({ vistaBrokerCode: "77" });
      expect((await profiles.getOwn(ana as never))!.vistaBrokerCodeVerifiedAt).not.toBeNull();
      await profiles.updateOwn(ana as never, { displayName: "Ana", vistaBrokerCode: "99" });
      expect(await profiles.getOwn(ana as never)).toMatchObject({ vistaBrokerCode: "77" });
      await expect(profiles.setVistaBrokerCode(ana as never, profile.id, "1")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(profiles.verifyProfessionalData(ana as never, profile.id, { creci: true })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("alterar o CRECI é uma solicitação: apaga a verificação até a equipe conferir", async () => {
      const ana = await user("Ana Creci", ["BROKER"]);
      const profile = await profiles.createOwn(ana as never, { displayName: "Ana", creci: "123456-F/SP" });
      await profiles.verifyProfessionalData(await admin() as never, profile.id, { creci: true });
      expect((await profiles.getOwn(ana as never))!.creciVerifiedAt).not.toBeNull();
      await profiles.updateOwn(ana as never, { displayName: "Ana", creci: "654321-F/SP" });
      expect(await profiles.getOwn(ana as never)).toMatchObject({ creci: "654321-F/SP", creciVerifiedAt: null });
    });
  });

  describe("site", () => {
    it("nasce em rascunho; segundo site é recusado", async () => {
      const { actor, site } = await broker("Ana Site", "ana-site");
      expect(site.status).toBe("DRAFT");
      await expect(sites.createOwn(actor as never, { subdomain: "ana-outro" })).rejects.toThrow("Você já possui um site.");
    });

    it("subdomínio duplicado e reservado são recusados; disponibilidade sugere alternativas", async () => {
      await broker("Ana Dup", "ana");
      const joao = await user("Joao Dup", ["BROKER"]);
      await profiles.createOwn(joao as never, { displayName: "João" });
      await expect(sites.createOwn(joao as never, { subdomain: "ana" })).rejects.toThrow("Este endereço já está em uso.");
      await expect(sites.createOwn(joao as never, { subdomain: "admin" })).rejects.toThrow(/reservado/);
      const check = await subdomains.checkAvailability("ana");
      expect(check).toMatchObject({ available: false });
      expect(check.available === false && check.suggestions[0]).toBe("ana-2");
      expect(await subdomains.checkAvailability("joao")).toEqual({ available: true, subdomain: "joao", publicUrl: "http://joao.maison.localhost:3000/" });
    });

    it("o banco também impede publicação sem aprovação registrada", async () => {
      const { site } = await broker("Ana Banco", "ana-banco");
      await expect(db.update(brokerSites).set({ status: "PUBLISHED" }).where(eq(brokerSites.id, site.id))).rejects.toThrow();
    });

    it("fluxo: rascunho → revisão → publicado (ADMIN) → suspenso → reativado", async () => {
      const { actor, site } = await broker("Ana Fluxo", "ana-fluxo");
      const adm = await admin();
      expect(await findPublishedSiteBySubdomain(db, "ana-fluxo")).toBeNull();
      await sites.submitForReview(actor as never, site.id, 0);
      expect(await findPublishedSiteBySubdomain(db, "ana-fluxo")).toBeNull();
      await expect(sites.approve(actor as never, site.id, 1)).rejects.toBeInstanceOf(BrokerSiteNotFoundError);
      await sites.approve(adm as never, site.id, 1);
      expect(await findPublishedSiteBySubdomain(db, "ana-fluxo")).toMatchObject({ subdomain: "ana-fluxo", status: "PUBLISHED", displayName: "Ana Fluxo" });
      await sites.suspend(adm as never, site.id, 2, "Conteúdo em desacordo com a política.");
      expect(await findPublishedSiteBySubdomain(db, "ana-fluxo")).toBeNull();
      await sites.reactivate(adm as never, site.id, 3);
      expect((await sites.getOwn(actor as never))!.status).toBe("DRAFT");
    });

    it("edição: rascunho e publicado (direta); em revisão bloqueada; endereço só em rascunho; versão otimista", async () => {
      const { actor, site } = await broker("Ana Edita", "ana-edita");
      await sites.updateContent(actor as never, site.id, { version: 0, headline: "Novo título", subdomain: "ana-edita-2", introText: "Minha seleção.", serviceText: "Atendo com hora marcada." });
      await expect(sites.updateContent(actor as never, site.id, { version: 0, headline: "x" })).rejects.toThrow(/outra sessão/);
      await expect(sites.updateContent(actor as never, site.id, { version: 1, headline: "<script>alert(1)</script>" })).rejects.toThrow(/HTML/);
      await sites.submitForReview(actor as never, site.id, 1);
      await expect(sites.updateContent(actor as never, site.id, { version: 2, headline: "y" })).rejects.toThrow(/em revisão/);
      await sites.approve(await admin() as never, site.id, 2);
      await sites.updateContent(actor as never, site.id, { version: 3, headline: "Título publicado" });
      await expect(sites.updateContent(actor as never, site.id, { version: 4, headline: "z", subdomain: "outro-endereco" })).rejects.toThrow(/rascunho/);
      expect(await findPublishedSiteBySubdomain(db, "ana-edita-2")).toMatchObject({ headline: "Título publicado", introText: "Minha seleção.", serviceText: "Atendo com hora marcada." });
    });
  });

  describe("isolamento e autorização", () => {
    it("corretor não acessa nem altera o site de outro (resposta de inexistente)", async () => {
      const ana = await broker("Ana Iso", "ana-iso");
      const joao = await broker("Joao Iso", "joao-iso");
      await expect(sites.authorize(joao.actor as never, ana.site.id, "read")).rejects.toBeInstanceOf(BrokerSiteNotFoundError);
      await expect(sites.updateContent(joao.actor as never, ana.site.id, { version: 0, headline: "invasão" })).rejects.toBeInstanceOf(BrokerSiteNotFoundError);
      await expect(sites.submitForReview(joao.actor as never, ana.site.id, 0)).rejects.toBeInstanceOf(BrokerSiteNotFoundError);
      expect((await sites.getOwn(joao.actor as never))!.id).toBe(joao.site.id);
    });

    it("MANAGER sem BROKER não lê nem lista sites; ADMIN gerencia todos", async () => {
      const ana = await broker("Ana Adm", "ana-adm");
      const manager = await user("Gestor Sites", ["MANAGER"]);
      await expect(sites.authorize(manager as never, ana.site.id, "read")).rejects.toBeInstanceOf(BrokerSiteNotFoundError);
      await expect(sites.listAll(manager as never)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(sites.getOwn(manager as never)).rejects.toBeInstanceOf(ForbiddenError);
      const adm = await admin();
      expect((await sites.listAll(adm as never)).map((site) => site.subdomain)).toContain("ana-adm");
      await expect(sites.authorize(adm as never, ana.site.id, "update")).resolves.toMatchObject({ subdomain: "ana-adm" });
    });

    it("usuário sem perfil profissional não cria site", async () => {
      const semPerfil = await user("Sem Perfil", ["BROKER"]);
      await expect(sites.createOwn(semPerfil as never, { subdomain: "sem-perfil" })).rejects.toBeInstanceOf(BrokerError);
    });
  });

  describe("visibilidade dos imóveis", () => {
    it("somente imóveis selecionados E elegíveis; despublicar na Maison remove de todos os sites", async () => {
      const ana = await broker("Ana Imoveis", "ana-imoveis");
      const joao = await broker("Joao Imoveis", "joao-imoveis");
      const [p1, p2, rascunho] = [await property(), await property(), await property(false)];
      await sites.addProperty(ana.actor as never, ana.site.id, p1.id);
      // Imóvel não publicado na Maison não pode ser selecionado.
      await expect(sites.addProperty(ana.actor as never, ana.site.id, rascunho.id)).rejects.toThrow(/indisponível/i);
      await sites.addProperty(joao.actor as never, joao.site.id, p1.id);
      await sites.addProperty(joao.actor as never, joao.site.id, p2.id);
      expect(await siteProperties.countVisible(ana.site.id)).toBe(1);
      expect(await siteProperties.countVisible(joao.site.id)).toBe(2);
      expect((await siteProperties.listVisible(ana.site.id)).items.map((item) => item.id)).toEqual([p1.id]);
      await db.update(curatedProperties).set({ published: false }).where(eq(curatedProperties.id, p1.id));
      expect(await siteProperties.countVisible(ana.site.id)).toBe(0);
      expect(await siteProperties.countVisible(joao.site.id)).toBe(1);
      await sites.removeProperty(joao.actor as never, joao.site.id, p2.id);
      expect((await db.select().from(curatedProperties).where(eq(curatedProperties.id, p2.id))).length).toBe(1);
      await expect(sites.addProperty(joao.actor as never, ana.site.id, p2.id)).rejects.toBeInstanceOf(BrokerSiteNotFoundError);
      await expect(sites.addProperty(ana.actor as never, ana.site.id, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(/curadoria/);
    });
  });

  describe("consultas do frontend público (6.4B)", () => {
    it("ordem: destaques do corretor primeiro, depois sort_order; slug e filtros restritos ao site", async () => {
      const ana = await broker("Ana Ordem", "ana-ordem");
      const joao = await broker("Joao Ordem", "joao-ordem");
      const [a, b, c, outro] = [await property(), await property(), await property(), await property()];
      await sites.addProperties(ana.actor as never, ana.site.id, [a.id, b.id, c.id]);
      await sites.moveProperty(ana.actor as never, ana.site.id, b.id, "up");
      await sites.setFeatured(ana.actor as never, ana.site.id, c.id, true);
      await sites.addProperty(joao.actor as never, joao.site.id, outro.id);
      expect((await siteProperties.featured(ana.site.id, 6)).map((item) => item.id)).toEqual([c.id, b.id, a.id]);
      expect(await siteProperties.findBySlug(ana.site.id, a.slug)).toMatchObject({ id: a.id });
      expect(await siteProperties.findBySlug(ana.site.id, outro.slug)).toBeNull();
      expect(await siteProperties.findBySlug(ana.site.id, "../x")).toBeNull();
      expect((await siteProperties.list(ana.site.id, { neighborhood: "Pinheiros" })).total).toBe(0);
      expect((await siteProperties.list(ana.site.id, { neighborhood: "moema", purpose: "SALE" })).total).toBe(3);
      expect(await siteProperties.facets(ana.site.id)).toEqual({ purposes: ["SALE"], types: ["APARTMENT"], neighborhoods: ["Moema"] });
      await db.update(curatedProperties).set({ published: false }).where(eq(curatedProperties.id, c.id));
      expect((await siteProperties.featured(ana.site.id, 6)).map((item) => item.id)).toEqual([b.id, a.id]);
      expect(await siteProperties.findBySlug(ana.site.id, c.slug)).toBeNull();
    });
  });

  describe("foto profissional (upload)", () => {
    const photo = () => sharp({ create: { width: 900, height: 900, channels: 3, background: { r: 200, g: 180, b: 170 } } }).jpeg().withExif({ IFD0: { Make: "Ficticia" } }).toBuffer();

    it("grava a foto tratada, substitui apagando a anterior e a visão pública usa /media", async () => {
      const ana = await broker("Ana Foto", "ana-foto");
      const first = await profiles.setPhoto(ana.actor as never, await photo());
      const second = await profiles.setPhoto(ana.actor as never, await photo());
      expect((await db.select({ id: mediaAssets.id }).from(mediaAssets)).map((row) => row.id)).toEqual([second.assetId]);
      expect(await findPublicMedia(db, first.assetId)).toBeNull();
      const media = await findPublicMedia(db, second.assetId);
      expect(media?.contentType).toBe("image/webp");
      expect((await sharp(media!.bytes).metadata())).toMatchObject({ width: 960, height: 1200, format: "webp" });
      expect((await findSiteViewById(db, ana.site.id))?.profileImageUrl).toBe(`/media/${second.assetId}`);
      await profiles.updateOwn(ana.actor as never, { displayName: "Ana Foto Editada" });
      expect((await profiles.getOwn(ana.actor as never))?.profileImageAssetId).toBe(second.assetId);
    });

    it("só o dono ou ADMIN trocam a foto; exige perfil; remover apaga o arquivo", async () => {
      const ana = await broker("Ana Perm", "ana-perm");
      const joao = await broker("Joao Perm", "joao-perm");
      await expect(profiles.setPhoto(joao.actor as never, await photo(), ana.actor.id)).rejects.toBeInstanceOf(ForbiddenError);
      const adm = await admin();
      const { assetId } = await profiles.setPhoto(adm as never, await photo(), ana.actor.id);
      expect((await profiles.getOwn(ana.actor as never))?.profileImageAssetId).toBe(assetId);
      const semPerfil = await user("Sem Perfil Foto", ["BROKER"]);
      await expect(profiles.setPhoto(semPerfil as never, await photo())).rejects.toThrow(/perfil profissional/);
      const manager = await user("Gestor Foto", ["MANAGER"]);
      await expect(profiles.setPhoto(manager as never, await photo())).rejects.toBeInstanceOf(ForbiddenError);
      await profiles.removePhoto(ana.actor as never);
      expect(await findPublicMedia(db, assetId)).toBeNull();
      expect((await findSiteViewById(db, ana.site.id))?.profileImageUrl).toBeNull();
    });

    it("arquivo inválido não grava nada", async () => {
      const ana = await broker("Ana Invalida", "ana-invalida");
      await expect(profiles.setPhoto(ana.actor as never, Buffer.from("não é imagem"))).rejects.toThrow();
      expect((await db.select().from(mediaAssets)).length).toBe(0);
    });
  });

  describe("editor do corretor (6.4C)", () => {
    it("seleção: adiciona vários, ignora duplicados, remove sem apagar da Maison, respeita limites", async () => {
      const ana = await broker("Ana Sel", "ana-sel");
      const [a, b] = [await property(), await property()];
      expect(await sites.addProperties(ana.actor as never, ana.site.id, [a.id, b.id, a.id])).toEqual({ added: 2, skipped: 0 });
      expect(await sites.addProperties(ana.actor as never, ana.site.id, [a.id])).toEqual({ added: 0, skipped: 1 });
      await expect(sites.addProperties(ana.actor as never, ana.site.id, Array.from({ length: 21 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`))).rejects.toThrow(/no máximo 20/);
      await sites.removeProperty(ana.actor as never, ana.site.id, a.id);
      expect((await sites.listSelection(ana.actor as never, ana.site.id)).map((item) => item.curatedPropertyId)).toEqual([b.id]);
      expect((await db.select().from(curatedProperties).where(eq(curatedProperties.id, a.id))).length).toBe(1);
      for (let i = 0; i < MAX_SELECTED_PROPERTIES - 1; i += 1) { const extra = await property(); await db.execute(sql`insert into broker_site_properties (broker_site_id, curated_property_id, sort_order) values (${ana.site.id}, ${extra.id}, ${i + 10})`); }
      await expect(sites.addProperty(ana.actor as never, ana.site.id, (await property()).id)).rejects.toThrow(/Limite de 60/);
    });

    it("destaques: no máximo seis, só da própria seleção; ordem independente por site", async () => {
      const ana = await broker("Ana Dest", "ana-dest");
      const items = []; for (let i = 0; i < 7; i += 1) items.push(await property());
      await sites.addProperties(ana.actor as never, ana.site.id, items.map((item) => item.id));
      for (const item of items.slice(0, 6)) await sites.setFeatured(ana.actor as never, ana.site.id, item.id, true);
      await expect(sites.setFeatured(ana.actor as never, ana.site.id, items[6].id, true)).rejects.toThrow(/no máximo 6/);
      const outro = await property();
      await expect(sites.setFeatured(ana.actor as never, ana.site.id, outro.id, true)).rejects.toThrow(/não está na sua seleção/);
      await sites.moveProperty(ana.actor as never, ana.site.id, items[1].id, "up");
      const order = (await sites.listSelection(ana.actor as never, ana.site.id)).map((item) => item.curatedPropertyId);
      expect(order.slice(0, 2)).toEqual([items[1].id, items[0].id]);
      expect(order[6]).toBe(items[6].id);
      await sites.moveProperty(ana.actor as never, ana.site.id, items[6].id, "up");
      expect((await sites.listSelection(ana.actor as never, ana.site.id))[6].curatedPropertyId).toBe(items[6].id);
      expect((await siteProperties.featured(ana.site.id, 6)).map((item) => item.id)[0]).toBe(items[1].id);
    });

    it("seleção marca imóveis que perderam elegibilidade; MANAGER + BROKER gerencia a própria seleção", async () => {
      const both = await broker("Gestora Sel", "gestora-sel", ["MANAGER"]);
      const p = await property();
      await sites.addProperty(both.actor as never, both.site.id, p.id);
      await db.update(curatedProperties).set({ published: false }).where(eq(curatedProperties.id, p.id));
      expect(await sites.listSelection(both.actor as never, both.site.id)).toMatchObject([{ curatedPropertyId: p.id, eligible: false }]);
    });

    it("completude: incompleto bloqueia envio e aprovação; completo permite; devolução exige justificativa", async () => {
      const ana = await broker("Ana Pronta", "ana-pronta");
      await expect(strictSites.submitForReview(ana.actor as never, ana.site.id, 0)).rejects.toThrow(/Complete os itens pendentes antes de solicitar a publicação: .*CRECI.*Foto/);
      const readiness = await strictSites.getReadiness(ana.actor as never, ana.site.id);
      expect(readiness).toMatchObject({ ready: false, total: 8 });
      expect(readiness.completed).toBeLessThan(8);
      const profile = (await profiles.getOwn(ana.actor as never))!;
      await profiles.updateOwn(ana.actor as never, { displayName: "Ana Pronta", creci: "123456-F/SP", biography: "Atendimento próximo para quem busca morar ou investir em São Paulo.", whatsapp: "11988887777" });
      const adm = await admin();
      await profiles.verifyProfessionalData(adm as never, profile.id, { creci: true });
      await profiles.setPhoto(ana.actor as never, await sharp({ create: { width: 900, height: 900, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer());
      const p = await property();
      await strictSites.addProperty(ana.actor as never, ana.site.id, p.id);
      expect(await strictSites.getReadiness(ana.actor as never, ana.site.id)).toMatchObject({ ready: true, completed: 8, missing: [] });
      await expect(strictSites.approve(adm as never, ana.site.id, 0)).rejects.toThrow(/não é permitida/);
      await strictSites.submitForReview(ana.actor as never, ana.site.id, 0);
      await expect(strictSites.approve(ana.actor as never, ana.site.id, 1)).rejects.toBeInstanceOf(BrokerSiteNotFoundError);
      await expect(strictSites.returnToDraft(adm as never, ana.site.id, 1, "curto")).rejects.toThrow(/justificativa/);
      await strictSites.returnToDraft(adm as never, ana.site.id, 1, "A biografia precisa de revisão antes da publicação.");
      expect((await strictSites.getOwn(ana.actor as never))).toMatchObject({ status: "DRAFT", lastReviewDecision: "RETURNED", lastReviewNotes: "A biografia precisa de revisão antes da publicação." });
      await strictSites.submitForReview(ana.actor as never, ana.site.id, 2);
      await db.update(curatedProperties).set({ published: false }).where(eq(curatedProperties.id, p.id));
      await expect(strictSites.approve(adm as never, ana.site.id, 3)).rejects.toThrow(/requisitos mínimos.*imóvel/);
      await db.update(curatedProperties).set({ published: true }).where(eq(curatedProperties.id, p.id));
      revalidate.mockClear();
      await strictSites.approve(adm as never, ana.site.id, 3);
      expect(revalidate).toHaveBeenCalled();
      expect(await strictSites.getOwn(ana.actor as never)).toMatchObject({ status: "PUBLISHED", lastReviewDecision: "APPROVED" });
      await expect(strictSites.suspend(adm as never, ana.site.id, 4, "")).rejects.toThrow(/motivo/);
      await strictSites.suspend(adm as never, ana.site.id, 4, "Documentação do CRECI vencida.");
      expect(await strictSites.getOwn(ana.actor as never)).toMatchObject({ status: "SUSPENDED", suspensionReason: "Documentação do CRECI vencida." });
      expect(await findPublishedSiteBySubdomain(db, "ana-pronta")).toBeNull();
      await strictSites.reactivate(adm as never, ana.site.id, 5);
      expect(await strictSites.getOwn(ana.actor as never)).toMatchObject({ status: "DRAFT", suspensionReason: null });
    });

    it("imagem de apresentação: inválida recusada; válida grava mídia própria e aparece na visão pública", async () => {
      const ana = await broker("Ana Hero", "ana-hero");
      await expect(sites.setHeroImage(ana.actor as never, ana.site.id, Buffer.from("<svg/>"))).rejects.toThrow();
      await expect(sites.setHeroImage(ana.actor as never, ana.site.id, await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 1, g: 1, b: 1 } } }).jpeg().toBuffer())).rejects.toThrow(/pequena demais/);
      const { assetId } = await sites.setHeroImage(ana.actor as never, ana.site.id, await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 9, g: 9, b: 9 } } }).png().toBuffer());
      expect((await db.select({ kind: mediaAssets.kind }).from(mediaAssets).where(eq(mediaAssets.id, assetId)))[0].kind).toBe("BROKER_SITE_HERO");
      expect((await findSiteViewById(db, ana.site.id))?.presentationImageUrl).toBe(`/media/${assetId}`);
      expect(await findPublicMedia(db, assetId)).not.toBeNull();
      const joao = await broker("Joao Hero", "joao-hero");
      await expect(sites.setHeroImage(joao.actor as never, ana.site.id, await sharp({ create: { width: 900, height: 900, channels: 3, background: { r: 9, g: 9, b: 9 } } }).png().toBuffer())).rejects.toBeInstanceOf(BrokerSiteNotFoundError);
    });

    it("cache: alterações relevantes acionam a revalidação dos sites", async () => {
      const ana = await broker("Ana Cache", "ana-cache");
      const p = await property();
      for (const work of [() => sites.addProperty(ana.actor as never, ana.site.id, p.id), () => sites.setFeatured(ana.actor as never, ana.site.id, p.id, true), () => sites.removeProperty(ana.actor as never, ana.site.id, p.id), () => sites.updateContent(ana.actor as never, ana.site.id, { version: 0, headline: "Novo" })]) {
        revalidate.mockClear(); await work(); expect(revalidate).toHaveBeenCalled();
      }
    });
  });

  it("perfis e sites não duplicam dados de autenticação", async () => {
    const { site } = await broker("Ana Dados", "ana-dados");
    const columns = Object.keys((await db.select().from(brokerProfiles).limit(1))[0]);
    expect(columns).not.toEqual(expect.arrayContaining(["passwordHash", "sessionVersion"]));
    expect(site).not.toHaveProperty("passwordHash");
  });
});
