CREATE TABLE "collection_slug_redirects" (
	"old_slug" varchar(160) PRIMARY KEY NOT NULL,
	"collection_id" uuid NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collection_slug_redirects_collection_idx" ON "collection_slug_redirects" USING btree ("collection_id");
