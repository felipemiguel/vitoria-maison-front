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
