import { loadEnvConfig } from "@next/env";
import { HttpVistaClient } from "../../src/integrations/vista/vista-client";
import { parseVistaConfig } from "../../src/integrations/vista/vista-config";
import { toSanitizedError } from "../../src/integrations/vista/vista-errors";

export function createVistaClient(): HttpVistaClient {
  loadEnvConfig(process.cwd());
  return new HttpVistaClient(parseVistaConfig());
}

export function readArgument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

export async function runDiagnostic(operation: () => Promise<void>): Promise<void> {
  try { await operation(); }
  catch (error) {
    console.error(JSON.stringify({ ok: false, error: toSanitizedError(error) }, null, 2));
    process.exitCode = 1;
  }
}

export function recordShape(record: Record<string, unknown> | null): Record<string, string> {
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value === null ? "null" : Array.isArray(value) ? `array(${value.length})` : typeof value]));
}
