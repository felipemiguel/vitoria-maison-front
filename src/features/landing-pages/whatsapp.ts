/**
 * Link do WhatsApp da landing page. O número é o da própria página ou, se vazio, o número
 * institucional (NEXT_PUBLIC_WHATSAPP_NUMBER). A mensagem aceita {codigo} e {titulo}.
 * Nenhum dado do visitante vai na URL e o clique não gera lead registrado.
 */
export const DEFAULT_WHATSAPP_MESSAGE = "Olá! Vi a página do imóvel {codigo} e gostaria de mais informações.";

export function normalizeWhatsappNumber(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length < 10 || digits.length > 13) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

export function resolveWhatsappNumber(pageNumber: string | null | undefined, fallback: string | null | undefined): string | null {
  return normalizeWhatsappNumber(pageNumber) ?? normalizeWhatsappNumber(fallback);
}

export function whatsappMessage(template: string | null | undefined, context: { code: string; title: string }): string {
  const source = template?.trim() || DEFAULT_WHATSAPP_MESSAGE;
  const code = /^[\w.-]{1,40}$/.test(context.code) ? context.code : "";
  return source.replaceAll("{codigo}", code).replaceAll("{titulo}", context.title.slice(0, 120)).replace(/\s{2,}/g, " ").trim().slice(0, 500);
}

export function whatsappHref(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
