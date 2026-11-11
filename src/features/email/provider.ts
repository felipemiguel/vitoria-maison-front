export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type EmailDelivery = { delivered: boolean; provider: string };

/** Envio transacional (convites e recuperação de senha). */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailDelivery>;
}

/**
 * Desenvolvimento: imprime a mensagem no terminal do servidor, inclusive o link,
 * SOMENTE fora de produção. Nada é enviado.
 */
export class DevelopmentEmailProvider implements EmailProvider {
  readonly name = "development";
  constructor(private readonly log: (line: string) => void = (line) => console.info(line)) {}
  async send(message: EmailMessage): Promise<EmailDelivery> {
    this.log(`\n[email:development] Para: ${message.to}\nAssunto: ${message.subject}\n\n${message.text}\n`);
    return { delivered: false, provider: this.name };
  }
}

/** Sem provider configurado em produção: não envia e não registra o conteúdo (que contém o token). */
export class DisabledEmailProvider implements EmailProvider {
  readonly name = "disabled";
  async send(): Promise<EmailDelivery> { return { delivered: false, provider: this.name }; }
}

/** Provider real via API HTTP do Resend (sem dependência adicional). */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(private readonly apiKey: string, private readonly from: string, private readonly fetchImpl: typeof fetch = fetch) {}
  async send(message: EmailMessage): Promise<EmailDelivery> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST", signal: controller.signal, redirect: "error",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      });
      if (!response.ok) console.error(JSON.stringify({ level: "error", event: "email.send.failed", provider: this.name, status: response.status }));
      return { delivered: response.ok, provider: this.name };
    } catch {
      console.error(JSON.stringify({ level: "error", event: "email.send.failed", provider: this.name, status: "NETWORK" }));
      return { delivered: false, provider: this.name };
    } finally { clearTimeout(timeout); }
  }
}

export function createEmailProvider(env: Partial<Record<string, string | undefined>> = process.env): EmailProvider {
  const kind = env.EMAIL_PROVIDER?.trim() || (env.NODE_ENV === "production" ? "disabled" : "development");
  if (kind === "resend") {
    const apiKey = env.RESEND_API_KEY?.trim(); const from = env.EMAIL_FROM?.trim();
    if (!apiKey || !from) throw new Error("EMAIL_PROVIDER=resend exige RESEND_API_KEY e EMAIL_FROM.");
    return new ResendEmailProvider(apiKey, from);
  }
  if (kind === "development" && env.NODE_ENV !== "production") return new DevelopmentEmailProvider();
  return new DisabledEmailProvider();
}
