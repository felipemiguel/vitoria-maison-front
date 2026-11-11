import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidMeasurementId, sanitizeEventParams, trackEvent } from "./events";

describe("analytics", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("descarta parâmetros fora da lista permitida e dados pessoais", () => {
    expect(sanitizeEventParams({
      lead_type: "PROPERTY_INTEREST", property_code: "16786218", source_page: "/contato",
      name: "Fulano", email: "fulano@exemplo.test", message: "texto livre", phone: "11999999999",
      neighborhood: "fulano@exemplo.test", collection: "11999999999",
    })).toEqual({ lead_type: "PROPERTY_INTEREST", property_code: "16786218", source_page: "/contato" });
  });

  it("não envia nada quando o GA não foi carregado", () => {
    vi.stubGlobal("window", {});
    expect(() => trackEvent("search", { purpose: "SALE" })).not.toThrow();
  });

  it("envia somente parâmetros sanitizados quando habilitado", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    trackEvent("generate_lead", { lead_type: "GENERAL_CONTACT", email: "x@y.test" });
    expect(gtag).toHaveBeenCalledWith("event", "generate_lead", { lead_type: "GENERAL_CONTACT" });
  });

  it("valida o ID de medição antes de injetar o script", () => {
    expect(isValidMeasurementId("G-ABC123XYZ")).toBe(true);
    expect(isValidMeasurementId("G-X');alert(1);//")).toBe(false);
    expect(isValidMeasurementId(undefined)).toBe(false);
  });
});
