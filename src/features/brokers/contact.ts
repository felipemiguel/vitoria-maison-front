/**
 * Link de WhatsApp com o contato profissional real configurado no perfil.
 * A mensagem contém apenas o código real e o link do imóvel no site do corretor; nenhum dado do visitante vai na URL.
 * O link é sempre wa.me (sem redirecionamento arbitrário). Abrir o WhatsApp não é registrado como lead.
 */
export function brokerWhatsappLink(whatsapp: string | null | undefined, context: { brokerName: string; propertyCode?: string; propertyUrl?: string | null } ): string | null {
  const digits = whatsapp?.replace(/\D/g, "") ?? "";
  if (digits.length < 10 || digits.length > 13) return null;
  const number = digits.length <= 11 ? `55${digits}` : digits;
  const firstName = context.brokerName.trim().split(/\s+/)[0];
  const code = context.propertyCode && /^[\w.-]{1,40}$/.test(context.propertyCode) ? context.propertyCode : null;
  const url = safeHttpUrl(context.propertyUrl);
  const text = code
    ? `Olá! Tenho interesse no imóvel ${code}${url ? ` divulgado em seu site: ${url}` : " divulgado em seu site"}.`
    : `Olá, ${firstName}! Vi seu site na Vitória Maison e gostaria de conversar sobre imóveis.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; }
}

/** Formatação de exibição: (11) 99999-9999. */
export function formatPhone(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  const local = digits.length > 11 ? digits.slice(-11) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return null;
}
