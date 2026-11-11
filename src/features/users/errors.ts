/** Erros com mensagem segura para exibição no painel. */
export class UserManagementError extends Error { constructor(message: string) { super(message); this.name = "UserManagementError"; } }
export class LastAdminError extends UserManagementError { constructor() { super("Operação bloqueada: o sistema precisa manter ao menos um administrador ativo."); this.name = "LastAdminError"; } }
export class UserConcurrencyError extends UserManagementError { constructor() { super("Este usuário foi alterado por outra pessoa. Recarregue a página."); this.name = "UserConcurrencyError"; } }
/** Mensagem genérica: não revela se o token existe, expirou, foi usado ou se a conta está inativa. */
export class InvalidTokenError extends UserManagementError { constructor() { super("Este link é inválido ou expirou. Solicite um novo link."); this.name = "InvalidTokenError"; } }

export function isLastAdminDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: unknown; cause?: unknown };
  return (typeof value.message === "string" && value.message.includes("LAST_ACTIVE_ADMIN")) || isLastAdminDatabaseError(value.cause);
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; cause?: unknown };
  return value.code === "23505" || isUniqueViolation(value.cause);
}
