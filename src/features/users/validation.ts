import { z } from "zod";
import { ROLE_CODES } from "@/features/access/permissions";

export const userNameSchema = z.string().trim().min(2, "Informe o nome (mínimo de 2 caracteres).").max(160, "Nome muito longo.");
export const userEmailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(320);
export const roleListSchema = z.array(z.enum(ROLE_CODES)).max(ROLE_CODES.length).transform((roles) => [...new Set(roles)].sort());

export const createUserSchema = z.object({ name: userNameSchema, email: userEmailSchema, roles: roleListSchema, active: z.boolean() });
export const updateUserSchema = createUserSchema.extend({ id: z.string().uuid(), version: z.coerce.number().int().nonnegative() });

export const newPasswordSchema = z.object({
  password: z.string().min(12, "A senha deve ter pelo menos 12 caracteres.").max(200, "Senha muito longa."),
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, { message: "As senhas não coincidem.", path: ["confirmation"] });

export const USER_SORTS = ["name", "email", "created", "lastLogin"] as const;
export const userListFiltersSchema = z.object({
  search: z.string().trim().max(100).optional().catch(undefined),
  role: z.enum(ROLE_CODES).optional().catch(undefined),
  status: z.enum(["active", "inactive", "invited"]).optional().catch(undefined),
  sort: z.enum(USER_SORTS).default("name").catch("name"),
  direction: z.enum(["asc", "desc"]).default("asc").catch("asc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
  pageSize: z.coerce.number().int().refine((value) => [10, 20, 50].includes(value)).default(20).catch(20),
});
export type UserListFilters = z.infer<typeof userListFiltersSchema>;

const SENSITIVE_KEY = /pass|hash|token|secret|key|cookie|session/i;
/** Metadata de auditoria sem senhas, hashes, tokens ou segredos. */
export function sanitizeAuditMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE_KEY.test(key)).map(([key, item]) => [key, item && typeof item === "object" && !Array.isArray(item) ? sanitizeAuditMetadata(item as Record<string, unknown>) : item]));
}
