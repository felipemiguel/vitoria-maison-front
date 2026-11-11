import type { EmailMessage } from "./provider";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

function layout(title: string, paragraphs: string[], cta: { label: string; url: string }, footer: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f0ec;font-family:Arial,sans-serif;color:#302724"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><p style="font-family:Georgia,serif;font-size:22px;letter-spacing:.08em;color:#66142e;margin:0">VITÓRIA MAISON</p><div style="background:#fff;border:1px solid #e4dcd5;border-radius:12px;padding:28px;margin-top:20px"><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${paragraphs.map((p) => `<p style="line-height:1.6;margin:0 0 14px">${escapeHtml(p)}</p>`).join("")}<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#66142e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">${escapeHtml(cta.label)}</a></p><p style="font-size:12px;color:#746c67;line-height:1.5;margin:0">${escapeHtml(footer)}</p></div></div></body></html>`;
}

export function invitationEmail(to: string, name: string, url: string, expiresHours: number): EmailMessage {
  const subject = "Seu acesso ao painel Vitória Maison";
  const lines = [`Olá, ${name}.`, "Você foi convidado para acessar o painel da Vitória Maison. Para ativar o acesso, defina sua senha pelo link abaixo.", `O link é pessoal, pode ser usado uma única vez e expira em ${expiresHours} horas.`];
  const footer = "Se você não esperava este convite, ignore esta mensagem. Nunca pedimos sua senha por e-mail.";
  return { to, subject, text: `${lines.join("\n\n")}\n\nDefinir senha: ${url}\n\n${footer}`, html: layout(subject, lines, { label: "Definir minha senha", url }, footer) };
}

export function passwordResetEmail(to: string, name: string, url: string, expiresMinutes: number): EmailMessage {
  const subject = "Redefinição de senha — Vitória Maison";
  const lines = [`Olá, ${name}.`, "Recebemos uma solicitação para redefinir a senha do seu acesso ao painel.", `O link pode ser usado uma única vez e expira em ${expiresMinutes} minutos. Ao redefinir, as sessões abertas serão encerradas.`];
  const footer = "Se você não fez esta solicitação, ignore esta mensagem: sua senha atual continua válida.";
  return { to, subject, text: `${lines.join("\n\n")}\n\nRedefinir senha: ${url}\n\n${footer}`, html: layout(subject, lines, { label: "Redefinir senha", url }, footer) };
}
