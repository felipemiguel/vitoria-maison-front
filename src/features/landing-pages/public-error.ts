import { z } from "zod";
import { AuthenticationRequiredError, ForbiddenError } from "@/features/access/errors";
import { InvalidImageError } from "@/features/media/image-processing";
import { LandingPageError } from "./landing-page-service";

export function publicLandingPageError(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof LandingPageError || error instanceof InvalidImageError || error instanceof ForbiddenError || error instanceof AuthenticationRequiredError) return error.message;
  console.error(JSON.stringify({ level: "error", event: "landing_pages.operation.failed", error: error instanceof Error ? error.name : "unknown" }));
  return fallback;
}
