import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDatabase, closeDatabase } from "../../src/database/client";

void (async () => {
  loadEnvConfig(process.cwd());
  try {
    await migrate(getDatabase(), { migrationsFolder: "drizzle" });
    console.log(JSON.stringify({ ok: true, migrationsFolder: "drizzle" }, null, 2));
  } catch (error) {
    const connectionRefused = hasErrorCode(error, "ECONNREFUSED");
    console.error(JSON.stringify({
      ok: false,
      error: connectionRefused
        ? "Não foi possível conectar ao PostgreSQL. Confirme se o servidor está ativo e se DATABASE_URL aponta para host e porta corretos."
        : "A migration falhou. Consulte a configuração e os logs do PostgreSQL.",
    }, null, 2));
    process.exitCode = 1;
  } finally { await closeDatabase(); }
})();

function hasErrorCode(error: unknown, expected: string): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; cause?: unknown; errors?: unknown[] };
  return value.code === expected
    || hasErrorCode(value.cause, expected)
    || value.errors?.some((item) => hasErrorCode(item, expected)) === true;
}
