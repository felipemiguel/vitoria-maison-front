import { z } from "zod";
import { AuthenticationRequiredError, ForbiddenError } from "@/features/access/errors";
import { UserManagementError } from "./errors";
import { RateLimitError } from "./rate-limit";

export function publicUserError(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof UserManagementError || error instanceof ForbiddenError || error instanceof AuthenticationRequiredError || error instanceof RateLimitError) return error.message;
  console.error(JSON.stringify({ level: "error", event: "users.operation.failed", error: error instanceof Error ? error.name : "unknown" }));
  return fallback;
}
