import { z } from "zod";
import { AdminOperationRateLimitError } from "@/features/admin/auth/admin-operation-rate-limit";
import { VistaError } from "@/integrations/vista/vista-errors";
import { AuthenticationRequiredError, ForbiddenError } from "@/features/access/errors";

export function publicVistaExplorerError(error: unknown): string {
  if (error instanceof AdminOperationRateLimitError || error instanceof ForbiddenError || error instanceof AuthenticationRequiredError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Dados inválidos.";
  if (error instanceof VistaError) {
    if (error.code === "TIMEOUT" || error.code === "NETWORK") return "O Vista está indisponível no momento. Tente novamente.";
    if (error.code === "HTTP" && error.details.status === 401) return "A autenticação com o Vista falhou. Contate o responsável técnico.";
    if (error.code === "HTTP" && error.details.status === 404) return "Imóvel não encontrado no Vista.";
  }
  if (error instanceof Error && /já está em processamento/i.test(error.message)) return error.message;
  return "Não foi possível concluir a operação no Vista.";
}
