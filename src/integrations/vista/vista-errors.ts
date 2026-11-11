export type VistaErrorCode =
  | "CONFIGURATION"
  | "VALIDATION"
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP"
  | "INVALID_JSON"
  | "REDIRECT_BLOCKED"
  | "MAPPING";

export class VistaError extends Error {
  constructor(
    message: string,
    readonly code: VistaErrorCode,
    readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "VistaError";
  }
}

export class VistaMappingError extends VistaError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, "MAPPING", details);
    this.name = "VistaMappingError";
  }
}

const secretKeys = /key|token|secret|authorization|credential/i;
const sensitiveQuery = /([?&](?:key|token|api[_-]?key)=)[^&\s]+/gi;

export function sanitizeForLog(value: unknown): unknown {
  if (typeof value === "string") return value.replace(sensitiveQuery, "$1[REDACTED]");
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      secretKeys.test(key) ? "[REDACTED]" : sanitizeForLog(item),
    ]));
  }
  return value;
}

export function toSanitizedError(error: unknown): Record<string, unknown> {
  if (error instanceof VistaError) return sanitizeForLog({
    name: error.name,
    code: error.code,
    message: error.message,
    details: error.details,
  }) as Record<string, unknown>;
  if (error instanceof Error) return { name: error.name, message: sanitizeForLog(error.message) };
  return { name: "UnknownError", message: "Erro desconhecido" };
}
