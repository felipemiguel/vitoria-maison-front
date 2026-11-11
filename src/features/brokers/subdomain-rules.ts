/** Regras de subdomínio (puras). Lista de reservados centralizada e extensível. */

export const SUBDOMAIN_MIN_LENGTH = 3;
export const SUBDOMAIN_MAX_LENGTH = 30;

/** Termos reservados exatos: infraestrutura, áreas oficiais e marca. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "www", "admin", "api", "app", "mail", "smtp", "ftp", "suporte", "contato", "blog", "status", "assets", "static", "cdn",
  "auth", "login", "dashboard", "vitoria", "maison", "vitoriamaison",
  // Extensões: infraestrutura de e-mail/DNS, ambientes e áreas que sugerem canal oficial.
  "imap", "pop", "pop3", "webmail", "email", "mx", "ns", "ns1", "ns2", "autoconfig", "autodiscover",
  "dev", "staging", "homolog", "homologacao", "preview", "test", "teste", "sandbox", "demo",
  "media", "img", "images", "files", "uploads", "docs", "help", "ajuda", "sac", "atendimento", "ouvidoria",
  "painel", "conta", "minha-conta", "seguranca", "security", "sistema", "root", "administrador", "adm",
  "oficial", "corretor", "corretores", "imoveis", "imovel", "comprar", "alugar", "investir", "colecoes",
  "site", "sites", "portal", "flats", "vitoriaflats", "vitoria-flats", "vitoria-maison",
]);

/** Fragmentos proibidos em qualquer posição: impedem nomes que imitem áreas oficiais. */
export const RESERVED_FRAGMENTS: readonly string[] = ["vitoriamaison", "vitoria-maison", "maison", "vitoriaflats", "oficial", "admin", "suporte", "atendimento"];

export type SubdomainProblem = "EMPTY" | "TOO_SHORT" | "TOO_LONG" | "INVALID_CHARACTERS" | "EDGE_HYPHEN" | "CONSECUTIVE_HYPHENS" | "RESERVED";

export const SUBDOMAIN_MESSAGES: Record<SubdomainProblem, string> = {
  EMPTY: "Informe o endereço do site.",
  TOO_SHORT: `Use pelo menos ${SUBDOMAIN_MIN_LENGTH} caracteres.`,
  TOO_LONG: `Use no máximo ${SUBDOMAIN_MAX_LENGTH} caracteres.`,
  INVALID_CHARACTERS: "Use apenas letras minúsculas sem acento, números e hífens.",
  EDGE_HYPHEN: "O endereço não pode começar nem terminar com hífen.",
  CONSECUTIVE_HYPHENS: "Não use hífens consecutivos.",
  RESERVED: "Este endereço é reservado. Escolha outro.",
};

export type SubdomainValidation = { ok: true; subdomain: string } | { ok: false; problem: SubdomainProblem; message: string };

/** Validação estrita. Apenas trim e minúsculas são aplicados; acentos e espaços são recusados. */
export function validateSubdomain(raw: unknown): SubdomainValidation {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const fail = (problem: SubdomainProblem): SubdomainValidation => ({ ok: false, problem, message: SUBDOMAIN_MESSAGES[problem] });
  if (!value) return fail("EMPTY");
  if (!/^[a-z0-9-]+$/.test(value)) return fail("INVALID_CHARACTERS");
  if (value.length < SUBDOMAIN_MIN_LENGTH) return fail("TOO_SHORT");
  if (value.length > SUBDOMAIN_MAX_LENGTH) return fail("TOO_LONG");
  if (value.startsWith("-") || value.endsWith("-")) return fail("EDGE_HYPHEN");
  if (value.includes("--")) return fail("CONSECUTIVE_HYPHENS");
  if (isReservedSubdomain(value)) return fail("RESERVED");
  return { ok: true, subdomain: value };
}

export function isReservedSubdomain(value: string): boolean {
  return RESERVED_SUBDOMAINS.has(value) || RESERVED_FRAGMENTS.some((fragment) => value.includes(fragment));
}

/** Formato DNS do rótulo, sem checar reservados (usado na resolução de hostname). */
export function isValidSubdomainFormat(value: string): boolean {
  return value.length >= SUBDOMAIN_MIN_LENGTH && value.length <= SUBDOMAIN_MAX_LENGTH && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value) && !value.includes("--");
}

/** Sugestão a partir de um nome: "Ana Souza Lima" → "ana-souza-lima". Não garante validade nem disponibilidade. */
export function normalizeSubdomainCandidate(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    .slice(0, SUBDOMAIN_MAX_LENGTH).replace(/-$/g, "");
}

/** Candidatos alternativos para resolver conflitos: base, base-2 … base-9, respeitando o tamanho. */
export function subdomainCandidates(base: string, count = 5): string[] {
  const root = normalizeSubdomainCandidate(base);
  const candidates = [root];
  for (let index = 2; candidates.length < count + 1 && index < 50; index += 1) {
    const suffix = `-${index}`;
    candidates.push(`${root.slice(0, SUBDOMAIN_MAX_LENGTH - suffix.length).replace(/-$/, "")}${suffix}`);
  }
  return candidates.filter((candidate) => validateSubdomain(candidate).ok);
}
