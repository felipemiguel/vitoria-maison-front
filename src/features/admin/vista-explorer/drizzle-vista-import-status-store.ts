import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { curatedProperties, propertySnapshots } from "@/database/schema";
import { publicVisibilityConditions } from "@/features/properties/publication/property-publication-policy";
import type { PublicationPolicyConfig } from "@/features/properties/config";
import type { VistaImportStatus } from "./types";
import type { VistaImportStatusStore } from "./vista-property-explorer-service";

export class DrizzleVistaImportStatusStore implements VistaImportStatusStore {
  constructor(private readonly db: NodePgDatabase<typeof schema>, private readonly policy: PublicationPolicyConfig, private readonly now: () => Date = () => new Date()) {}

  async findByCodes(codes: string[]): Promise<Map<string, VistaImportStatus>> {
    const uniqueCodes = [...new Set(codes)];
    if (!uniqueCodes.length) return new Map();
    const rows = await this.db.select({ id: curatedProperties.id, code: curatedProperties.vistaCode, published: curatedProperties.published })
      .from(curatedProperties).where(inArray(curatedProperties.vistaCode, uniqueCodes));
    const eligible = rows.length ? await this.db.select({ id: curatedProperties.id }).from(curatedProperties)
      .innerJoin(propertySnapshots, eq(propertySnapshots.curatedPropertyId, curatedProperties.id))
      .where(and(inArray(curatedProperties.id, rows.map((row) => row.id)), ...publicVisibilityConditions(this.now(), this.policy))) : [];
    const eligibleIds = new Set(eligible.map((row) => row.id));
    return new Map(rows.map((row) => [row.code, row.published ? { kind: eligibleIds.has(row.id) ? "PUBLISHED" : "BLOCKED", id: row.id } : { kind: "DRAFT", id: row.id }]));
  }
}
