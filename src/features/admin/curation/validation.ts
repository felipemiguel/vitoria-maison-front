import { z } from "zod";

export function optionalSafeImageUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const parsed = z.string().url().parse(raw);
  const url = new URL(parsed);
  if (url.protocol !== "https:") throw new Error("A imagem deve usar HTTPS.");
  const allowed = new Set([process.env.VISTA_IMAGE_HOSTNAME, ...(process.env.ADMIN_ALLOWED_IMAGE_HOSTNAMES ?? "").split(",")].map((item) => item?.trim()).filter(Boolean));
  if (!allowed.has(url.hostname)) throw new Error("O domínio da imagem não está autorizado.");
  return url.toString();
}

export const editorialInputSchema = z.object({
  id: z.string().uuid(), version: z.coerce.number().int().nonnegative(),
  title: z.string().trim().max(240).transform((value) => value || null),
  description: z.string().trim().max(10_000).transform((value) => value || null),
  purpose: z.enum(["SALE", "RENT", "INVESTMENT"]).nullable(),
  coverUrl: z.unknown().transform(optionalSafeImageUrl),
});

export const featuredInputSchema = z.object({
  id: z.string().uuid(), version: z.coerce.number().int().nonnegative(), featured: z.boolean(),
  order: z.coerce.number().int().min(1).max(999).nullable(),
}).refine((value) => !value.featured || value.order !== null, { message: "Informe a ordem do destaque." });

export const collectionInputSchema = z.object({
  id: z.string().uuid().optional(), version: z.coerce.number().int().nonnegative().optional(),
  name: z.string().trim().min(2).max(200), slug: z.string().trim().toLowerCase().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2_000).transform((value) => value || null), coverImageUrl: z.unknown().transform(optionalSafeImageUrl),
  published: z.boolean(), sortOrder: z.coerce.number().int().min(0).max(9999),
});
