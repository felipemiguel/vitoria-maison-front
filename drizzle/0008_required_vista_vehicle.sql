ALTER TABLE "lead_submissions" ADD COLUMN "vista_vehicle" varchar(200);
UPDATE "lead_submissions" SET "vista_vehicle" = COALESCE("property_vista_code", 'LEGACY-' || "type"::text) WHERE "vista_vehicle" IS NULL;
ALTER TABLE "lead_submissions" ALTER COLUMN "vista_vehicle" SET NOT NULL;
