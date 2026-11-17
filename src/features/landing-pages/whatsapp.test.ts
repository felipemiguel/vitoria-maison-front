import { describe, expect, it } from "vitest";
import { DEFAULT_WHATSAPP_MESSAGE, normalizeWhatsappNumber, resolveWhatsappNumber, whatsappHref, whatsappMessage } from "./whatsapp";

describe("WhatsApp da landing page", () => {
  it("normaliza o número com DDI 55 e recusa números inválidos", () => {
    expect(normalizeWhatsappNumber("(11) 99999-8888")).toBe("5511999998888");
    expect(normalizeWhatsappNumber("+55 11 99999-8888")).toBe("5511999998888");
    expect(normalizeWhatsappNumber("123")).toBeNull();
    expect(normalizeWhatsappNumber("")).toBeNull();
  });

  it("usa o número da página e, sem ele, o institucional", () => {
    expect(resolveWhatsappNumber("11 98888-7777", "11 3085-1381")).toBe("5511988887777");
    expect(resolveWhatsappNumber(null, "11 3085-1381")).toBe("551130851381");
    expect(resolveWhatsappNumber(null, "")).toBeNull();
  });

  it("mensagem: padrão, {codigo} e {titulo}; código inválido não entra", () => {
    expect(whatsappMessage(null, { code: "123", title: "Apto" })).toBe(DEFAULT_WHATSAPP_MESSAGE.replace("{codigo}", "123"));
    expect(whatsappMessage("Quero o {titulo} ({codigo})", { code: "A-1", title: "Flat Moema" })).toBe("Quero o Flat Moema (A-1)");
    expect(whatsappMessage("Imóvel {codigo}", { code: "<x>", title: "" })).toBe("Imóvel");
  });

  it("link sempre wa.me com texto codificado", () => {
    expect(whatsappHref("5511999998888", "Olá & tudo?")).toBe("https://wa.me/5511999998888?text=Ol%C3%A1%20%26%20tudo%3F");
  });
});
