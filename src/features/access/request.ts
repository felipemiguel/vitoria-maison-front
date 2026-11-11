import { headers } from "next/headers";
import { isSameOriginRequest } from "@/features/users/origin";
import { UserManagementError } from "@/features/users/errors";

/**
 * Defesa em profundidade contra CSRF nas Server Actions de acesso. O Next.js já compara Origin e
 * Host nas Server Actions; esta verificação explícita também cobre proxies mal configurados.
 */
export async function assertSameOriginAction(): Promise<void> {
  const h = await headers();
  if (!isSameOriginRequest(h.get("origin"), h.get("x-forwarded-host") ?? h.get("host"))) throw new UserManagementError("Requisição inválida. Recarregue a página e tente novamente.");
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
