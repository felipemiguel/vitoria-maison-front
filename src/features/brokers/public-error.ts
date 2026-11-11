import { z } from "zod";
import { AuthenticationRequiredError, ForbiddenError } from "@/features/access/errors";
import { BrokerError } from "./errors";

export function publicBrokerError(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof BrokerError || error instanceof ForbiddenError || error instanceof AuthenticationRequiredError) return error.message;
  console.error(JSON.stringify({ level: "error", event: "brokers.operation.failed", error: error instanceof Error ? error.name : "unknown" }));
  return fallback;
}
