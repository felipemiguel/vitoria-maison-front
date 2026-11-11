import { describe, expect, it } from "vitest";
import { parseVistaConfig } from "./vista-config";

const validEnv: NodeJS.ProcessEnv = { NODE_ENV: "test", VISTA_POC_ENABLED: "true", VISTA_API_BASE_URL: "https://cliente.vistahost.com.br", VISTA_API_KEY: "fictional-test-key", VISTA_API_TIMEOUT_MS: "15000" };

describe("parseVistaConfig", () => {
  it("aceita configuração HTTPS válida", () => expect(parseVistaConfig(validEnv).baseUrl.href).toBe("https://cliente.vistahost.com.br/"));
  it("rejeita HTTP", () => expect(() => parseVistaConfig({ ...validEnv, VISTA_API_BASE_URL: "http://cliente.vistahost.com.br" })).toThrow(/HTTPS/));
  it("rejeita execução desabilitada", () => expect(() => parseVistaConfig({ ...validEnv, VISTA_POC_ENABLED: "false" })).toThrow(/desabilitada/));
  it("rejeita credenciais embutidas na URL", () => expect(() => parseVistaConfig({ ...validEnv, VISTA_API_BASE_URL: "https://user:pass@cliente.vistahost.com.br" })).toThrow(/credenciais/));
});
