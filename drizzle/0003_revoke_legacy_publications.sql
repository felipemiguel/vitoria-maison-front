INSERT INTO "property_publication_events" ("curated_property_id", "event_type", "actor", "details")
SELECT "id", 'UNPUBLISHED', 'migration-0003', '{"reason":"Legacy approval revoked before safe publication flow"}'::jsonb
FROM "curated_properties"
WHERE "published" = true;

UPDATE "curated_properties"
SET "published" = false, "publication_version" = "publication_version" + 1, "updated_at" = now()
WHERE "published" = true;
