import { z } from "zod";
import { AdminConcurrencyError } from "./curation/admin-curation-service";
import { AuthenticationRequiredError, ForbiddenError } from "@/features/access/errors";

const safeMessages = [/não encontrado/i,/não possui preço/i,/alterad[oa] por outra pessoa/i,/somente imóveis publicados/i,/associe pelo menos/i,/ordem .* inválida/i,/duplicado/i,/não existe/i,/disponibilidade/i,/Vista já confirmou/i,/operador é obrigatório/i,/domínio da imagem/i,/imagem deve usar HTTPS/i];
export function publicAdminError(error:unknown,fallback="Não foi possível concluir a operação."):string{
  if(error instanceof ForbiddenError||error instanceof AuthenticationRequiredError)return error.message;
  if(error instanceof z.ZodError)return error.issues[0]?.message??fallback;
  if(error instanceof AdminConcurrencyError)return error.message;
  if(error instanceof Error&&safeMessages.some(pattern=>pattern.test(error.message)))return error.message;
  return fallback;
}
