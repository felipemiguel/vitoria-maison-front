import { describe, expect, it, vi } from "vitest";
import { buildVistaUrl, HttpVistaClient } from "./vista-client";
import type { VistaConfig } from "./vista-config";
import { VistaError, sanitizeForLog } from "./vista-errors";

const config: VistaConfig = { baseUrl: new URL("https://cliente.vistahost.com.br/"), apiKey: "fictional-test-key", timeoutMs: 1_000, enabled: true };
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe("HttpVistaClient", () => {
  it("serializa pesquisa e query com URLSearchParams", () => {
    const url = buildVistaUrl(config, "imoveis/listar", { fields: ["Codigo"], paginacao: { pagina: 1, quantidade: 5 } }, { showtotal: "1" });
    expect(url.pathname).toBe("/imoveis/listar");
    expect(JSON.parse(url.searchParams.get("pesquisa")!)).toEqual({ fields: ["Codigo"], paginacao: { pagina: 1, quantidade: 5 } });
    expect(url.searchParams.get("showtotal")).toBe("1");
  });

  it("usa Accept JSON, bloqueia redirects automáticos e retorna JSON", async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const client = new HttpVistaClient(config, { fetch: fetchMock as typeof fetch, logger, retries: 0 });
    await expect(client.listProperties({ fields: ["Codigo"], pageSize: 5 })).resolves.toEqual({ ok: true });
    const requestOptions = (fetchMock.mock.calls as unknown[][])[0][1];
    expect(requestOptions).toMatchObject({ redirect: "manual", headers: { Accept: "application/json" } });
  });

  it("trata erro HTTP sem incluir corpo potencialmente sensível", async () => {
    const client = new HttpVistaClient(config, { fetch: vi.fn(async () => new Response("segredo", { status: 400 })) as typeof fetch, logger, retries: 0 });
    await expect(client.listProperties({ fields: ["Codigo"] })).rejects.toMatchObject({ code: "HTTP", details: { status: 400 } });
  });

  it("trata JSON inválido", async () => {
    const client = new HttpVistaClient(config, { fetch: vi.fn(async () => new Response("not-json", { status: 200 })) as typeof fetch, logger, retries: 0 });
    await expect(client.listProperties({ fields: ["Codigo"] })).rejects.toMatchObject({ code: "INVALID_JSON" });
  });

  it("converte abort por timeout em erro controlado", async () => {
    const hangingFetch = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const client = new HttpVistaClient(config, { fetch: hangingFetch as typeof fetch, logger, retries: 0 });
    await expect(client.listProperties({ fields: ["Codigo"] })).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("repete somente falhas HTTP transitórias", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("temporário", { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const client = new HttpVistaClient(config, { fetch: fetchMock as typeof fetch, logger, retries: 1, sleep: async () => undefined });
    await expect(client.listProperties({ fields: ["Codigo"] })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sanitiza chaves e URLs em logs", () => {
    expect(sanitizeForLog({ apiKey: "secret", url: "https://x.test/?key=secret&foo=1" })).toEqual({ apiKey: "[REDACTED]", url: "https://x.test/?key=[REDACTED]&foo=1" });
  });

  it("aceita o limite oficial de cinquenta registros", async () => {
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    const client = new HttpVistaClient(config, { fetch: fetchMock as typeof fetch, logger });
    await expect(client.listProperties({ fields: ["Codigo"], pageSize: 50 })).resolves.toEqual([]);
  });

  it("rejeita mais de cinquenta registros", async () => {
    const client = new HttpVistaClient(config, { fetch: vi.fn() as typeof fetch, logger });
    await expect(client.listProperties({ fields: ["Codigo"], pageSize: 51 })).rejects.toBeInstanceOf(VistaError);
  });

  it("serializa filtros e ordenação do contrato tipado", async () => {
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    const client = new HttpVistaClient(config, { fetch: fetchMock as typeof fetch, logger, retries: 0 });
    await client.listProperties({ fields: ["Codigo"], pageSize: 20, filter: { Cidade: ["like", "São Paulo"] }, advFilter: { Or: { ValorVenda: [100, 200], ValorLocacao: [100, 200] } }, order: { Codigo: "asc" } });
    const url = (fetchMock.mock.calls[0] as unknown[])[0] as URL;
    expect(JSON.parse(url.searchParams.get("pesquisa")!)).toMatchObject({ filter: { Cidade: ["like", "São Paulo"] }, advFilter: { Or: { ValorVenda: [100, 200], ValorLocacao: [100, 200] } }, order: { Codigo: "asc" } });
  });
});
