import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, like, sql } from "drizzle-orm";
import * as schema from "@/database/schema";
import { adminAuditEvents, adminUsers, curatedProperties, leadDeliveryAttempts, leadSubmissions, propertySnapshots, roles, userRoles } from "@/database/schema";
import { loadSessionUser } from "@/features/access/session-user";
import type { RoleCode } from "@/features/access/permissions";
import { DrizzleLeadStore, LeadStateError } from "@/features/leads/drizzle-lead-store";
import { LeadSubmissionService } from "@/features/leads/lead-submission-service";
import type { LeadDeliveryResult, LeadProvider, ResolvedLead } from "@/features/leads/types";
import { BrokerLeadSubmissionService, LeadOriginError } from "./broker-lead-submission-service";
import { BrokerProfileService } from "./broker-profile-service";
import { BrokerSiteService } from "./broker-site-service";

/**
 * Leads por corretor com PostgreSQL real (banco de TESTE). Nenhum lead é enviado ao Vista:
 * o provider é um dublê que registra o que seria enviado.
 */
const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration("leads por corretor (PostgreSQL)", () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  const db = drizzle(pool, { schema });
  const policy = { defaultState: "SP", confirmationTtlDays: 7, snapshotMaxAgeHours: 48 };
  const hosts = ["fotos.teste.local"];
  const profiles = new BrokerProfileService(db, hosts);
  const ready = { evaluate: async () => ({ ready: true, completed: 8, total: 8, missing: [], items: [] }) };
  const sites = new BrokerSiteService(db, hosts, async () => undefined, undefined, { policy, readiness: ready });
  const store = new DrizzleLeadStore(db, policy);
  const config = { enabled: true, baseDomain: "maison.localhost", institutionalHosts: new Set(["localhost", "maison.localhost", "www.maison.localhost"]) };
  let next: LeadDeliveryResult = { status: "DELIVERED", reference: "22574", brokerCode: "3" };
  const sent: ResolvedLead[] = [];
  const provider: LeadProvider = { sendLead: vi.fn(async (lead: ResolvedLead) => { sent.push(lead); return next; }) };
  const service = (verification = false, leadsEnabled = true) => new BrokerLeadSubmissionService(db, new LeadSubmissionService(store, provider, "test-secret", () => new Date(), { brokerAssignmentVerification: verification }), config, leadsEnabled);
  let counter = 0;

  afterAll(async () => pool.end());
  beforeEach(async () => {
    sent.length = 0; next = { status: "DELIVERED", reference: "22574", brokerCode: "3" };
    await db.execute(sql`truncate table lead_delivery_attempts, lead_submissions, broker_site_properties, broker_sites, broker_profiles, media_assets, user_audit_events`);
    await db.delete(adminAuditEvents).where(eq(adminAuditEvents.entityType, "LEAD"));
    await db.delete(curatedProperties).where(like(curatedProperties.vistaCode, "BLD-%"));
    await db.execute(sql`truncate table user_roles`);
    await db.delete(adminUsers).where(like(adminUsers.email, "%@broker-leads.local"));
  });

  async function user(name: string, roleCodes: RoleCode[]) {
    const row = (await db.insert(adminUsers).values({ name, email: `${name.toLowerCase().replace(/\W+/g, ".")}@broker-leads.local`, passwordHash: "x" }).returning())[0];
    for (const code of roleCodes) await db.insert(userRoles).values({ userId: row.id, roleId: (await db.select().from(roles).where(eq(roles.code, code)))[0].id });
    return (await loadSessionUser(db, row.id, 0))!;
  }
  async function property() {
    counter += 1;
    const code = `BLD-${counter}-${Date.now()}`;
    const curated = (await db.insert(curatedProperties).values({ vistaCode: code, slug: code.toLowerCase(), published: true, publicationPurpose: "SALE" }).returning())[0];
    await db.insert(propertySnapshots).values({ curatedPropertyId: curated.id, externalCode: code, category: "APARTMENT", city: "São Paulo", neighborhood: "Moema", salePrice: "900000", privateArea: "60", sourceTitle: "Apartamento fictício", coverImageUrl: "https://fotos.teste.local/1.jpg", availabilityStatus: "AVAILABLE", fetchedAt: new Date() });
    return curated;
  }
  /** Corretor com site PUBLICADO e um imóvel selecionado. */
  async function publishedBroker(name: string, subdomain: string, extraRoles: RoleCode[] = [], vistaCode?: string) {
    const actor = await user(name, ["BROKER", ...extraRoles]);
    const profile = await profiles.createOwn(actor, { displayName: name, whatsapp: "11988887777" });
    const adm = await user(`Admin ${name}`, ["ADMIN"]);
    if (vistaCode) await profiles.setVistaBrokerCode(adm, profile.id, vistaCode);
    const site = await sites.createOwn(actor, { subdomain, headline: `Imóveis com ${name}` });
    const listed = await property();
    await sites.addProperties(actor, site.id, [listed.id]);
    await sites.submitForReview(actor, site.id, 0);
    await sites.approve(adm, site.id, 1);
    return { actor, site, listed, adm };
  }
  const form = (overrides: Record<string, unknown> = {}) => ({ type: "PROPERTY_INTEREST", name: "Visitante Teste", email: "", phone: "11977776666", message: "", sourcePage: "/imoveis/x", submissionKey: crypto.randomUUID(), website: "", ...overrides });
  const row = async (id: string) => (await db.select().from(leadSubmissions).where(eq(leadSubmissions.id, id)))[0];

  describe("origem", () => {
    it("lead do site institucional: MAISON_SITE, sem corretor, atribuição não se aplica", async () => {
      const listed = await property();
      const result = await service().submit(form({ propertyId: listed.id }), "s1", "localhost:3000");
      expect(await row(result.id)).toMatchObject({ source: "MAISON_SITE", brokerSiteId: null, brokerUserId: null, assignmentStatus: "NOT_APPLICABLE", sourceHostname: "localhost", vistaReference: "22574" });
      expect(sent[0].vistaBrokerCode).toBeNull();
    });

    it("lead do site da Ana e do João: cada um vinculado ao próprio corretor e site, resolvidos no servidor", async () => {
      const ana = await publishedBroker("Ana Leads", "ana-leads", [], "3");
      const joao = await publishedBroker("Joao Leads", "joao-leads", [], "8");
      const a = await service().submit(form({ propertyId: ana.listed.id, sourcePage: `/imoveis/${ana.listed.slug}` }), "s-a", "ana-leads.maison.localhost:3000");
      const j = await service().submit(form({ type: "GENERAL_CONTACT", vehicle: "Contato pelo site do corretor", message: "Quero conversar" }), "s-j", "joao-leads.maison.localhost");
      expect(await row(a.id)).toMatchObject({ source: "BROKER_SITE", brokerSiteId: ana.site.id, brokerUserId: ana.actor.id, sourceHostname: "ana-leads.maison.localhost", sourcePath: `/imoveis/${ana.listed.slug}`, sourcePage: `/corretor/ana-leads/imoveis/${ana.listed.slug}`, vistaBrokerCodeRequested: "3", propertyId: ana.listed.id });
      expect(await row(j.id)).toMatchObject({ source: "BROKER_SITE", brokerSiteId: joao.site.id, brokerUserId: joao.actor.id, propertyId: null, type: "GENERAL_CONTACT", message: "Quero conversar" });
      // Contato sem imóvel e sem mensagem recebe a mensagem padrão (o Vista exige "mensagem").
      const empty = await service().submit(form({ type: "GENERAL_CONTACT", vehicle: "Contato pelo site do corretor", phone: "11955554444" }), "s-j2", "joao-leads.maison.localhost");
      expect((await row(empty.id)).message).toBe("Gostaria de conversar sobre imóveis.");
    });

    it("histórico preservado: trocar o subdomínio não altera a origem de leads anteriores; a origem é imutável no banco", async () => {
      const ana = await publishedBroker("Ana Historico", "ana-hist");
      const lead = await service().submit(form({ propertyId: ana.listed.id }), "s", "ana-hist.maison.localhost");
      await db.execute(sql`update broker_sites set subdomain = 'ana-novo' where id = ${ana.site.id}`);
      expect(await row(lead.id)).toMatchObject({ sourceHostname: "ana-hist.maison.localhost", brokerSiteId: ana.site.id });
      const outro = await publishedBroker("Outro Corretor", "outro-hist");
      await expect(db.update(leadSubmissions).set({ brokerUserId: outro.actor.id }).where(eq(leadSubmissions.id, lead.id))).rejects.toThrow();
      await expect(db.update(leadSubmissions).set({ sourceHostname: "x.maison.localhost" }).where(eq(leadSubmissions.id, lead.id))).rejects.toThrow();
      await expect(db.update(leadSubmissions).set({ source: "MAISON_SITE" }).where(eq(leadSubmissions.id, lead.id))).rejects.toThrow();
    });
  });

  describe("validação", () => {
    it("site inexistente, em rascunho e suspenso não aceitam contatos; site B continua funcionando", async () => {
      const ana = await publishedBroker("Ana Suspensa", "ana-susp");
      const bia = await publishedBroker("Bia Ativa", "bia-ativa");
      await expect(service().submit(form({ propertyId: ana.listed.id }), "s", "ninguem.maison.localhost")).rejects.toBeInstanceOf(LeadOriginError);
      const draftActor = await user("Draft Broker", ["BROKER"]);
      await profiles.createOwn(draftActor, { displayName: "Draft" });
      await sites.createOwn(draftActor, { subdomain: "draft-site" });
      await expect(service().submit(form({ type: "GENERAL_CONTACT", vehicle: "x" }), "s", "draft-site.maison.localhost")).rejects.toBeInstanceOf(LeadOriginError);
      await sites.suspend(ana.adm, ana.site.id, 2, "Suspensão para teste de leads.");
      await expect(service().submit(form({ propertyId: ana.listed.id }), "s", "ana-susp.maison.localhost")).rejects.toThrow(/não está recebendo contatos/);
      const ok = await service().submit(form({ propertyId: bia.listed.id }), "s-b", "bia-ativa.maison.localhost");
      expect((await row(ok.id)).brokerSiteId).toBe(bia.site.id);
    });

    it("corretor desativado ou sem perfil BROKER: o site deixa de aceitar contatos", async () => {
      const ana = await publishedBroker("Ana Inativa", "ana-inativa");
      await db.update(adminUsers).set({ active: false }).where(eq(adminUsers.id, ana.actor.id));
      await expect(service().submit(form({ propertyId: ana.listed.id }), "s", "ana-inativa.maison.localhost")).rejects.toBeInstanceOf(LeadOriginError);
    });

    it("imóvel fora da seleção do site, de outro corretor ou despublicado na Maison → recusado sem registrar", async () => {
      const ana = await publishedBroker("Ana Imovel", "ana-imovel");
      const joao = await publishedBroker("Joao Imovel", "joao-imovel");
      const loose = await property();
      for (const id of [loose.id, joao.listed.id]) await expect(service().submit(form({ propertyId: id }), "s", "ana-imovel.maison.localhost")).rejects.toThrow(/neste site/);
      await db.update(curatedProperties).set({ published: false }).where(eq(curatedProperties.id, ana.listed.id));
      await expect(service().submit(form({ propertyId: ana.listed.id }), "s", "ana-imovel.maison.localhost")).rejects.toThrow(/neste site/);
      expect((await db.select().from(leadSubmissions)).length).toBe(0);
      expect(sent.length).toBe(0);
    });

    it("adulteração: brokerUserId/brokerSiteId/source no corpo são ignorados", async () => {
      const ana = await publishedBroker("Ana Forja", "ana-forja");
      const joao = await publishedBroker("Joao Forja", "joao-forja");
      const result = await service().submit(form({ propertyId: ana.listed.id, brokerUserId: joao.actor.id, brokerSiteId: joao.site.id, source: "MAISON_SITE" }), "s", "ana-forja.maison.localhost");
      expect(await row(result.id)).toMatchObject({ brokerUserId: ana.actor.id, brokerSiteId: ana.site.id, source: "BROKER_SITE" });
    });

    it("submissão duplicada (mesma chave) e spam (honeypot) não geram novos envios", async () => {
      const ana = await publishedBroker("Ana Dup", "ana-dup");
      const payload = form({ propertyId: ana.listed.id });
      const first = await service().submit(payload, "s", "ana-dup.maison.localhost");
      const again = await service().submit(payload, "s", "ana-dup.maison.localhost");
      expect(again.id).toBe(first.id);
      expect(sent.length).toBe(1);
      await expect(service().submit(form({ propertyId: ana.listed.id, website: "http://spam" }), "s", "ana-dup.maison.localhost")).rejects.toThrow();
      expect(sent.length).toBe(1);
    });

    it("BROKER_LEADS_ENABLED=false: site de corretor recusa; site institucional continua aceitando", async () => {
      const ana = await publishedBroker("Ana Flag", "ana-flag");
      await expect(service(false, false).submit(form({ propertyId: ana.listed.id }), "s", "ana-flag.maison.localhost")).rejects.toThrow(/ainda não está disponível/);
      const maison = await service(false, false).submit(form({ propertyId: ana.listed.id }), "s2", "localhost");
      expect((await row(maison.id)).source).toBe("MAISON_SITE");
    });
  });

  describe("integração Vista e atribuição", () => {
    it("sem contrato confirmado: entregue + UNVERIFIED (o 'Corretor' retornado é guardado, mas não confirma nada)", async () => {
      const ana = await publishedBroker("Ana Unver", "ana-unver", [], "3");
      const result = await service(false).submit(form({ propertyId: ana.listed.id }), "s", "ana-unver.maison.localhost");
      expect(await row(result.id)).toMatchObject({ deliveryStatus: "DELIVERED", assignmentStatus: "UNVERIFIED", vistaBrokerCodeReturned: "3", vistaReference: "22574" });
      const attempts = await db.select().from(leadDeliveryAttempts).where(eq(leadDeliveryAttempts.leadSubmissionId, result.id));
      expect(attempts[0]).toMatchObject({ status: "DELIVERED", vistaReference: "22574", vistaBrokerCodeReturned: "3" });
    });

    it("com contrato confirmado: CONFIRMED quando coincide; MISMATCH quando o Vista mantém outro corretor (cliente existente)", async () => {
      const ana = await publishedBroker("Ana Conf", "ana-conf", [], "3");
      const ok = await service(true).submit(form({ propertyId: ana.listed.id }), "s", "ana-conf.maison.localhost");
      expect((await row(ok.id)).assignmentStatus).toBe("CONFIRMED");
      next = { status: "DELIVERED", reference: "22575", brokerCode: "9" };
      const other = await service(true).submit(form({ propertyId: ana.listed.id, phone: "11911112222" }), "s2", "ana-conf.maison.localhost");
      expect(await row(other.id)).toMatchObject({ assignmentStatus: "MISMATCH", vistaBrokerCodeReturned: "9" });
    });

    it("timeout: UNKNOWN + atribuição PENDING; reconciliação manual auditada; FAILED permite nova tentativa com reserva atômica", async () => {
      const ana = await publishedBroker("Ana Timeout", "ana-timeout", [], "3");
      next = { status: "UNKNOWN", errorCode: "TIMEOUT" };
      const lead = await service().submit(form({ propertyId: ana.listed.id }), "s", "ana-timeout.maison.localhost");
      expect(await row(lead.id)).toMatchObject({ deliveryStatus: "UNKNOWN", assignmentStatus: "PENDING" });
      expect(sent.length).toBe(1);
      await expect(store.claimForRetry(lead.id, new Date())).resolves.toBeNull();
      await expect(store.checkAssignment(lead.id, ana.adm.id, "CONFIRMED", null, new Date())).rejects.toBeInstanceOf(LeadStateError);
      await store.reconcileDelivery(lead.id, ana.adm.id, "FAILED", null, new Date());
      const [a, b] = await Promise.all([store.claimForRetry(lead.id, new Date()), store.claimForRetry(lead.id, new Date())]);
      expect([a, b].filter(Boolean).length).toBe(1);
      await store.recordDelivery(lead.id, { status: "DELIVERED", reference: "30001" }, 10, new Date(), { status: "UNVERIFIED", returnedCode: null });
      expect(await row(lead.id)).toMatchObject({ deliveryStatus: "DELIVERED", assignmentStatus: "UNVERIFIED", vistaReference: "30001" });
      await store.checkAssignment(lead.id, ana.adm.id, "MISMATCH", "9", new Date());
      expect(await row(lead.id)).toMatchObject({ assignmentStatus: "MISMATCH", assignmentCheckedBy: ana.adm.id });
      const audit = await db.select().from(adminAuditEvents).where(eq(adminAuditEvents.entityId, lead.id));
      expect(audit.map((event) => event.action).sort()).toEqual(["LEAD_ASSIGNMENT_CHECKED", "LEAD_DELIVERY_RECONCILED"]);
      expect(JSON.stringify(audit)).not.toContain("11977776666");
      // Nova entrega não sobrescreve conferência manual.
      await store.recordDelivery(lead.id, { status: "DELIVERED" }, 1, new Date(), { status: "CONFIRMED", returnedCode: "3" });
      expect((await row(lead.id)).assignmentStatus).toBe("MISMATCH");
    });
  });

  describe("isolamento do painel", () => {
    it("corretor A vê só os próprios leads; B não vê os de A; escopo exige site E usuário", async () => {
      const ana = await publishedBroker("Ana Painel", "ana-painel");
      const joao = await publishedBroker("Joao Painel", "joao-painel", ["MANAGER"]);
      await service().submit(form({ propertyId: ana.listed.id }), "s1", "ana-painel.maison.localhost");
      await service().submit(form({ propertyId: ana.listed.id, phone: "11933334444" }), "s2", "ana-painel.maison.localhost");
      await service().submit(form({ propertyId: joao.listed.id }), "s3", "joao-painel.maison.localhost");
      await service().submit(form({ propertyId: ana.listed.id, phone: "11922223333" }), "s4", "localhost");
      const mine = await store.listForBroker({ brokerSiteId: ana.site.id, brokerUserId: ana.actor.id }, { page: 1, pageSize: 20 });
      expect(mine.total).toBe(2);
      expect(mine.items.every((item) => item.sourceHostname === "ana-painel.maison.localhost")).toBe(true);
      expect((await store.listForBroker({ brokerSiteId: joao.site.id, brokerUserId: joao.actor.id }, { page: 1, pageSize: 20 })).total).toBe(1);
      // Site de A com o usuário de B (ou vice-versa) não retorna nada.
      expect((await store.listForBroker({ brokerSiteId: ana.site.id, brokerUserId: joao.actor.id }, { page: 1, pageSize: 20 })).total).toBe(0);
      const stats = await store.brokerStats({ brokerSiteId: ana.site.id, brokerUserId: ana.actor.id }, new Date());
      expect(stats).toMatchObject({ total: 2, last30: 2, delivered: 2, assignmentPending: 2, mismatch: 0 });
      expect(stats.byProperty).toEqual([{ code: ana.listed.vistaCode, title: "Apartamento fictício", total: 2 }]);
      // Visão administrativa global com filtros por corretor, site e canal.
      expect((await store.list({ page: 1, pageSize: 20 })).total).toBe(4);
      expect((await store.list({ brokerUserId: ana.actor.id, page: 1, pageSize: 20 })).total).toBe(2);
      expect((await store.list({ brokerSiteId: joao.site.id, page: 1, pageSize: 20 })).items[0]).toMatchObject({ brokerName: "Joao Painel", subdomain: "joao-painel" });
      expect((await store.list({ source: "MAISON_SITE", page: 1, pageSize: 20 })).total).toBe(1);
    });
  });
});
