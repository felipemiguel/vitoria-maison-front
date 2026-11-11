/** Erros com mensagem segura para exibição. */
export class BrokerError extends Error { constructor(message: string) { super(message); this.name = "BrokerError"; } }
/** Usado tanto para "não existe" quanto para "não é seu": evita enumeração de sites de outros corretores. */
export class BrokerSiteNotFoundError extends BrokerError { constructor() { super("Site não encontrado."); this.name = "BrokerSiteNotFoundError"; } }
export class BrokerConcurrencyError extends BrokerError { constructor() { super("Este site foi alterado em outra sessão. Recarregue a página."); this.name = "BrokerConcurrencyError"; } }
