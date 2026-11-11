import { loadEnvConfig } from "@next/env";
import { getDatabase, closeDatabase } from "../../src/database/client";
import { DrizzlePropertySyncStore } from "../../src/features/properties/sync/drizzle-property-sync-store";
import { PropertySyncService } from "../../src/features/properties/sync/property-sync-service";
import { HttpVistaClient } from "../../src/integrations/vista/vista-client";
import { parseVistaConfig } from "../../src/integrations/vista/vista-config";
import { toSanitizedError } from "../../src/integrations/vista/vista-errors";
import { DrizzlePropertyPublicationStore } from "../../src/features/properties/publication/drizzle-property-publication-store";
import { PropertyPublicationService } from "../../src/features/properties/publication/property-publication-service";
import { getPublicationPolicyConfig } from "../../src/features/properties/config";

export function initializeDatabaseBackend() {
  loadEnvConfig(process.cwd());
  const db = getDatabase();
  const store = new DrizzlePropertySyncStore(db);
  const publicationStore = new DrizzlePropertyPublicationStore(db);
  return { db, store, publication: new PropertyPublicationService(publicationStore, getPublicationPolicyConfig()) };
}

export function initializeBackend() {
  const { db, store } = initializeDatabaseBackend();
  const vista = new HttpVistaClient(parseVistaConfig());
  return { db, store, sync: new PropertySyncService(vista, store, 2, process.env.VISTA_IMAGE_HOSTNAME) };
}

export function argument(name: string): string | undefined {
  return process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

export async function runBackend(operation: () => Promise<unknown>): Promise<void> {
  try { const result = await operation(); console.log(JSON.stringify({ ok: true, result }, null, 2)); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: toSanitizedError(error) }, null, 2)); process.exitCode = 1; }
  finally { await closeDatabase(); }
}
