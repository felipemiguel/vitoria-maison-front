import type { Permission } from "./permissions";

/** Sem sessão válida (ausente, expirada, revogada ou usuário inativo). */
export class AuthenticationRequiredError extends Error {
  constructor() { super("Sua sessão expirou. Entre novamente."); this.name = "AuthenticationRequiredError"; }
}

/** Sessão válida, mas sem a permissão exigida. A mensagem pública não revela a regra interna. */
export class ForbiddenError extends Error {
  constructor(readonly required: readonly Permission[]) { super("Você não tem permissão para executar esta operação."); this.name = "ForbiddenError"; }
}
