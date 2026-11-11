import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
integration("PostgreSQL schema integration", () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
  afterAll(async () => pool.end());
  it("encontra as tabelas após migrations no banco de teste", async () => {
    const result = await pool.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)", [["curated_properties", "property_snapshots", "collections", "collection_properties", "sync_runs", "property_publication_events", "admin_users", "admin_login_attempts", "admin_audit_events", "admin_bulk_imports", "lead_submissions", "lead_delivery_attempts", "roles", "user_roles", "user_tokens", "user_audit_events"]]);
    expect(result.rows.map((row) => row.table_name).sort()).toEqual(["admin_audit_events", "admin_bulk_imports", "admin_login_attempts", "admin_users", "collection_properties", "collections", "curated_properties", "lead_delivery_attempts", "lead_submissions", "property_publication_events", "property_snapshots", "roles", "sync_runs", "user_audit_events", "user_roles", "user_tokens"]);
  });

  it("cria os três perfis iniciais", async () => {
    const result = await pool.query<{ code: string }>("select code from roles order by code");
    expect(result.rows.map((row) => row.code)).toEqual(["ADMIN", "BROKER", "MANAGER"]);
  });
});
