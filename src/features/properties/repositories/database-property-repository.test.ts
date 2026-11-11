import { describe, expect, it } from "vitest";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { DatabasePropertyRepository } from "./database-property-repository";

describe("DatabasePropertyRepository publication gate", () => {
  it("retorna vazio sem disponibilidade confirmada e não consulta o banco", async () => {
    const repository = new DatabasePropertyRepository({} as NodePgDatabase<typeof schema>, { defaultState: undefined, confirmationTtlDays: 7, snapshotMaxAgeHours: 48 });
    await expect(repository.list()).resolves.toMatchObject({ items: [], total: 0 });
    await expect(repository.findBySlug("qualquer")).resolves.toBeNull();
  });
});
