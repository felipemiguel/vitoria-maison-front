import { z } from "zod";
import { isHttpsUrl } from "@/features/seo/config";

const optionalText = (max: number) => z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().trim().max(max).nullable().optional());
const phone = z.preprocess((value) => typeof value === "string" ? (value.replace(/\D/g, "") || null) : value, z.string().regex(/^\d{10,13}$/, "Telefone deve ter DDD e número (10 a 13 dígitos).").nullable().optional());
const list = z.array(z.string().trim().min(2).max(60)).max(12, "Informe no máximo 12 itens.").transform((items) => [...new Set(items)]);

export function allowedImageHosts(env: Partial<Record<string, string | undefined>> = process.env): string[] {
  return [env.VISTA_IMAGE_HOSTNAME, env.ADMIN_ALLOWED_IMAGE_HOSTNAMES].flatMap((value) => (value ?? "").split(",")).map((value) => value.trim().toLowerCase()).filter(Boolean);
}

/** Imagens públicas: HTTPS e host previamente autorizado (mesma lista do next.config). */
export function imageUrlSchema(hosts: string[]) {
  return z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(2000).refine(isHttpsUrl, "A imagem deve usar HTTPS.")
      .refine((value) => hosts.includes(new URL(value).hostname.toLowerCase()), "O domínio da imagem não é permitido.").nullable().optional());
}

export function brokerProfileSchema(hosts: string[]) {
  return z.object({
    displayName: z.string().trim().min(2, "Informe o nome de exibição.").max(120),
    professionalTitle: optionalText(120),
    biography: optionalText(2000),
    profileImageUrl: imageUrlSchema(hosts),
    whatsapp: phone,
    phone,
    emailPublic: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().trim().toLowerCase().email("E-mail público inválido.").max(320).nullable().optional()),
    creci: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().trim().toUpperCase().regex(/^[0-9]{1,8}(-?[A-Z])?(\/[A-Z]{2})?$/, "CRECI inválido (ex.: 123456-F/SP).").nullable().optional()),
    vistaBrokerCode: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/, "Código do Vista inválido.").nullable().optional()),
    specialties: list.default([]),
    serviceRegions: list.default([]),
  });
}
export type BrokerProfileInput = z.infer<ReturnType<typeof brokerProfileSchema>>;

/**
 * Texto editorial simples: sem HTML/JavaScript (recusa "<" e ">"), sem caracteres de controle,
 * espaços normalizados e limite de tamanho. O React ainda escapa tudo ao renderizar.
 */
export const plainText = (max: number) => z.preprocess(
  (value) => typeof value === "string" ? (value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() || null) : value,
  z.string().max(max, `Use no máximo ${max} caracteres.`).refine((value) => !/[<>]/.test(value), "Não use os caracteres < e > (HTML não é permitido).").nullable().optional(),
);

export function brokerSiteContentSchema(hosts: string[]) {
  return z.object({ headline: plainText(160), subtitle: plainText(300), heroImageUrl: imageUrlSchema(hosts), introText: plainText(400), serviceText: plainText(300) });
}
