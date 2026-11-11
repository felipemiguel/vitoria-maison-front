import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { mediaAssets } from "@/database/schema";

type Db = NodePgDatabase<typeof schema>;

/** Leitura pública de mídia: somente tipos destinados à exibição pública (foto profissional e imagem de apresentação). */
export async function findPublicMedia(db: Db, id: string): Promise<{ bytes: Buffer; contentType: string; sha256: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = (await db.select({ bytes: mediaAssets.bytes, contentType: mediaAssets.contentType, sha256: mediaAssets.sha256 })
    .from(mediaAssets).where(and(eq(mediaAssets.id, id), inArray(mediaAssets.kind, ["BROKER_PROFILE_PHOTO", "BROKER_SITE_HERO"]))).limit(1))[0];
  return row ?? null;
}
