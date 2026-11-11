import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "./config";
import * as schema from "./schema";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

export function getDatabase(): NodePgDatabase<typeof schema> {
  if (!database) {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
    database = drizzle(pool, { schema });
  }
  return database;
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
