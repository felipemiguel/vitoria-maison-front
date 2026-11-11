import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUuid } from "./random-id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomUuid", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("usa crypto.randomUUID quando disponível", () => {
    expect(randomUuid()).toMatch(UUID_V4);
  });

  it("funciona fora de contexto seguro (sem randomUUID), gerando UUID v4 válido e único", () => {
    const real = globalThis.crypto;
    // Simula HTTP comum: só getRandomValues existe.
    vi.stubGlobal("crypto", { getRandomValues: <T extends ArrayBufferView>(array: T) => real.getRandomValues(array as unknown as Uint8Array) as unknown as T });
    const values = new Set(Array.from({ length: 50 }, () => randomUuid()));
    expect(values.size).toBe(50);
    for (const value of values) expect(value).toMatch(UUID_V4);
  });
});
