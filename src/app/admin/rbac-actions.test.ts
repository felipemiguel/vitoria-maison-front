import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleCode } from "@/features/access/permissions";
import { effectivePermissions } from "@/features/access/permissions";

/**
 * Regressão de autorização: cada Server Action e página administrativa existente é chamada com
 * sessões de perfis diferentes. Sessão e usuário são simulados; nenhuma operação real é executada.
 */
const state = vi.hoisted(() => ({ roles: [] as string[] | null, origin: "https://painel.vitoria.test" as string | null }));

vi.mock("@/auth", () => ({ auth: async () => (state.roles ? { user: { id: "00000000-0000-4000-8000-000000000001", name: "Teste", email: "t@teste.local" }, sessionVersion: 0 } : null), signOut: vi.fn() }));
vi.mock("@/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/features/access/session-user", () => ({
  loadSessionUser: async () => state.roles === null ? null : ({ id: "00000000-0000-4000-8000-000000000001", name: "Teste", email: "t@teste.local", active: true, roles: state.roles, permissions: [...effectivePermissions({ active: true, roles: state.roles })], sessionVersion: 0 }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: state.origin ?? "", host: "painel.vitoria.test" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), refresh: vi.fn() }));

const FORBIDDEN = "Você não tem permissão para executar esta operação.";
const as = (...roles: RoleCode[]) => { state.roles = roles; };
const form = (entries: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(entries)) data.set(key, value); return data; };
const uuid = "00000000-0000-4000-8000-0000000000aa";
const digest = (promise: Promise<unknown>) => promise.then(() => "NO_THROW", (error: { digest?: string }) => error.digest ?? String(error));

beforeEach(() => { state.roles = []; state.origin = "https://painel.vitoria.test"; });

describe("operações de imóveis exigem permissão no servidor", () => {
  it("BROKER não importa (código e lote), não publica, não sincroniza e não edita", async () => {
    as("BROKER");
    const novo = await import("./(protected)/imoveis/novo/actions");
    const vista = await import("./(protected)/vista/actions");
    const imovel = await import("./(protected)/imoveis/[id]/actions");
    const destaques = await import("./(protected)/destaques/actions");
    expect(await novo.previewPropertyAction({}, form({ code: "31" }))).toMatchObject({ error: FORBIDDEN });
    expect(await novo.importPropertyAction({}, form({ code: "31" }))).toEqual({ error: FORBIDDEN });
    expect(await vista.previewVistaPropertyAction("31")).toEqual({ error: FORBIDDEN });
    expect(await vista.bulkImportPropertiesAction({}, form({ codes: "[\"31\"]", idempotencyKey: "k" }))).toEqual({ error: FORBIDDEN });
    const target = { id: uuid, code: "31", version: "0" };
    expect(await imovel.publishPropertyAction({}, form(target))).toEqual({ error: FORBIDDEN });
    expect(await imovel.unpublishPropertyAction({}, form(target))).toEqual({ error: FORBIDDEN });
    expect(await imovel.confirmAvailabilityAction({}, form(target))).toEqual({ error: FORBIDDEN });
    expect(await imovel.syncPropertyAction({}, form(target))).toEqual({ error: FORBIDDEN });
    expect(await imovel.updateEditorialAction({}, form(target))).toEqual({ error: FORBIDDEN });
    expect(await imovel.updateFeaturedAction({}, form(target))).toEqual({ error: FORBIDDEN });
    expect(await imovel.saveAndPublishPropertyAction({}, form(target))).toEqual({ error: FORBIDDEN });
    expect(await destaques.reorderHighlightsAction({}, form({}))).toEqual({ error: FORBIDDEN });
  });

  it("MANAGER passa pela autorização de importação, publicação e sincronização", async () => {
    as("MANAGER");
    const { requireAllPermissions } = await import("@/features/access/server");
    await expect(requireAllPermissions(["properties:import", "properties:publish", "properties:sync", "properties:edit"])).resolves.toMatchObject({ roles: ["MANAGER"] });
  });
});

describe("coleções e leads", () => {
  it("BROKER não gerencia coleções nem reprocessa leads", async () => {
    as("BROKER");
    const colecoes = await import("./(protected)/colecoes/actions");
    const leads = await import("./(protected)/leads/actions");
    expect(await colecoes.createCollectionAction({}, form({ name: "Nova" }))).toEqual({ error: FORBIDDEN });
    expect(await colecoes.saveCollectionAction({}, form({ id: uuid, version: "0" }))).toEqual({ error: FORBIDDEN });
    expect(await leads.retryLeadAction({}, form({ id: uuid }))).toEqual({ error: FORBIDDEN });
  });
});

describe("gestão de usuários", () => {
  it("MANAGER e BROKER não criam, editam nem reenviam convites", async () => {
    const actions = await import("./(protected)/usuarios/actions");
    for (const roles of [["MANAGER"], ["BROKER"], ["MANAGER", "BROKER"]] as RoleCode[][]) {
      as(...roles);
      expect(await actions.createUserAction({}, form({ name: "Nova Pessoa", email: "nova@teste.local" }))).toEqual({ error: FORBIDDEN });
      expect(await actions.updateUserAction({}, form({ id: uuid, version: "0", name: "Nova Pessoa", email: "nova@teste.local" }))).toEqual({ error: FORBIDDEN });
      expect(await actions.resendInviteAction({}, form({ id: uuid }))).toEqual({ error: FORBIDDEN });
    }
  });

  it("requisição de outra origem é rejeitada (CSRF), mesmo para ADMIN", async () => {
    as("ADMIN"); state.origin = "https://atacante.test";
    const actions = await import("./(protected)/usuarios/actions");
    expect(await actions.createUserAction({}, form({ name: "Nova Pessoa", email: "nova@teste.local" }))).toEqual({ error: "Requisição inválida. Recarregue a página e tente novamente." });
  });

  it("sessão inválida, expirada ou revogada não executa nada", async () => {
    state.roles = null;
    const actions = await import("./(protected)/usuarios/actions");
    expect(await actions.createUserAction({}, form({ name: "Nova Pessoa", email: "nova@teste.local" }))).toEqual({ error: "Sua sessão expirou. Entre novamente." });
    const vista = await import("./(protected)/vista/actions");
    expect(await vista.bulkImportPropertiesAction({}, form({}))).toEqual({ error: "Sua sessão expirou. Entre novamente." });
  });
});

describe("páginas", () => {
  it("sem sessão vai para o login; sem permissão vai para acesso negado", async () => {
    const { requirePagePermission } = await import("@/features/access/server");
    state.roles = null;
    expect(await digest(requirePagePermission("users:read"))).toContain("/admin/login");
    as("MANAGER");
    expect(await digest(requirePagePermission("users:read"))).toContain("/admin/acesso-negado");
    as("BROKER");
    expect(await digest(requirePagePermission("properties:read"))).toContain("/admin/acesso-negado");
    await expect(requirePagePermission("account:manage-own")).resolves.toMatchObject({ roles: ["BROKER"] });
  });

  it("dashboard redireciona BROKER para a área pessoal", async () => {
    as("BROKER");
    const page = await import("./(protected)/page");
    expect(await digest(page.default())).toContain("/admin/minha-conta");
  });

  it("lista de usuários exige users:read", async () => {
    as("MANAGER");
    const page = await import("./(protected)/usuarios/page");
    expect(await digest(page.default({ searchParams: Promise.resolve({}) }))).toContain("/admin/acesso-negado");
  });
});

describe("sites de corretores", () => {
  it("MANAGER sem BROKER não cria perfil, não cria site e não abre as telas", async () => {
    as("MANAGER");
    const mine = await import("./(protected)/meu-site/actions");
    expect(await mine.saveOwnProfileAction({}, form({ displayName: "Gestor" }))).toEqual({ error: FORBIDDEN });
    expect(await mine.createOwnSiteAction({}, form({ subdomain: "gestor" }))).toEqual({ error: FORBIDDEN });
    const { requirePagePermission } = await import("@/features/access/server");
    expect(await digest(requirePagePermission("broker-site:read-own"))).toContain("/admin/acesso-negado");
    expect(await digest(requirePagePermission("broker-site:manage-all"))).toContain("/admin/acesso-negado");
  });

  it("BROKER não aprova, suspende nem reativa sites", async () => {
    as("BROKER");
    const admin = await import("./(protected)/sites-corretores/actions");
    for (const operation of ["approve", "suspend", "reactivate", "returnToDraft"]) expect(await admin.changeSiteStatusAction({}, form({ id: uuid, version: "0", operation }))).toEqual({ error: FORBIDDEN });
  });

  it("sem sessão nenhuma ação de site é executada", async () => {
    state.roles = null;
    const mine = await import("./(protected)/meu-site/actions");
    expect(await mine.submitOwnSiteAction({}, form({ version: "0" }))).toEqual({ error: "Sua sessão expirou. Entre novamente." });
  });
});

describe("editor do corretor e revisão (6.4C)", () => {
  it("MANAGER sem BROKER não seleciona imóveis, não destaca, não envia imagem nem abre a prévia", async () => {
    as("MANAGER");
    const mine = await import("./(protected)/meu-site/actions");
    expect(await mine.addPropertiesAction({}, form({ single: uuid }))).toEqual({ error: FORBIDDEN });
    expect(await mine.manageSelectionAction({}, form({ propertyId: uuid, op: "feature" }))).toEqual({ error: FORBIDDEN });
    expect(await mine.updateOwnSiteAction({}, form({ version: "0", headline: "x" }))).toEqual({ error: FORBIDDEN });
    const ownPreview = await import("./(protected)/meu-site/previa/guard");
    expect(await digest(ownPreview.authorizeOwnPreview())).toContain("/admin/acesso-negado");
  });

  it("BROKER não abre prévia administrativa, não verifica CRECI nem define código Vista", async () => {
    as("BROKER");
    const adminPreview = await import("./(protected)/sites-corretores/[id]/previa/guard");
    expect(await digest(adminPreview.authorizeAdminPreview(uuid))).toContain("/admin/acesso-negado");
    const review = await import("./(protected)/sites-corretores/actions");
    expect(await review.verifyCreciAction({}, form({ profileId: uuid, siteId: uuid }))).toEqual({ error: FORBIDDEN });
    expect(await review.setVistaCodeAction({}, form({ profileId: uuid, siteId: uuid, vistaBrokerCode: "1" }))).toEqual({ error: FORBIDDEN });
  });
});

describe("leads por corretor (6.4D)", () => {
  it("BROKER não reenvia, não reconcilia nem confere atribuição de leads", async () => {
    as("BROKER");
    const leads = await import("./(protected)/leads/actions");
    expect(await leads.retryLeadAction({}, form({ id: uuid }))).toEqual({ error: FORBIDDEN });
    expect(await leads.reconcileLeadAction({}, form({ id: uuid, outcome: "DELIVERED", vistaReference: "" }))).toEqual({ error: FORBIDDEN });
    expect(await leads.checkLeadAssignmentAction({}, form({ id: uuid, outcome: "CONFIRMED", observedCode: "" }))).toEqual({ error: FORBIDDEN });
  });

  it("MANAGER sem BROKER não abre Meus leads; BROKER não abre a lista global de leads", async () => {
    as("MANAGER");
    const mine = await import("./(protected)/meu-site/leads/page");
    expect(await digest(mine.default({ searchParams: Promise.resolve({}) }))).toContain("/admin/acesso-negado");
    as("BROKER");
    const global = await import("./(protected)/leads/page");
    expect(await digest(global.default({ searchParams: Promise.resolve({}) }))).toContain("/admin/acesso-negado");
  });

  it("reconciliação exige mesma origem (CSRF)", async () => {
    as("ADMIN");
    state.origin = "https://atacante.test";
    const leads = await import("./(protected)/leads/actions");
    expect((await leads.reconcileLeadAction({}, form({ id: uuid, outcome: "DELIVERED", vistaReference: "" }))).error).toMatch(/Requisição inválida/);
  });
});

