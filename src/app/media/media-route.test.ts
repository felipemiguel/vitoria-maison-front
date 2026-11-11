import { describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, { bytes: Buffer; contentType: string; sha256: string }>());
vi.mock("@/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/features/media/media-service", () => ({ findPublicMedia: async (_db: unknown, id: string) => store.get(id) ?? null }));

describe("rota de mídia", () => {
  const id = "00000000-0000-4000-8000-0000000000aa";
  const call = async (target: string, headers: Record<string, string> = {}) => (await import("./[id]/route")).GET(new Request(`http://x/media/${target}`, { headers }), { params: Promise.resolve({ id: target }) });

  it("entrega a imagem com cache imutável e cabeçalhos de segurança", async () => {
    store.set(id, { bytes: Buffer.from("RIFF....WEBP"), contentType: "image/webp", sha256: "a".repeat(64) });
    const response = await call(id);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect((await call(id, { "if-none-match": `"${"a".repeat(64)}"` })).status).toBe(304);
  });

  it("ID inexistente ou malformado → 404", async () => {
    expect((await call("00000000-0000-4000-8000-0000000000bb")).status).toBe(404);
    expect((await call("../../etc/passwd")).status).toBe(404);
  });
});
