import { sql } from "drizzle-orm";
import { boolean, customType, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar, index } from "drizzle-orm/pg-core";

export const publicationPurposeEnum = pgEnum("publication_purpose", ["SALE", "RENT", "INVESTMENT"]);
export const snapshotSyncStatusEnum = pgEnum("snapshot_sync_status", ["SUCCESS"]);
export const syncRunStatusEnum = pgEnum("sync_run_status", ["RUNNING", "SUCCESS", "PARTIAL", "FAILED"]);
export const availabilityStatusEnum = pgEnum("availability_status", ["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]);
export const leadTypeEnum = pgEnum("lead_type", ["PROPERTY_INTEREST", "GENERAL_CONTACT", "OWNER_CONTACT", "INVESTMENT_CONSULTING"]);
export const leadDeliveryStatusEnum = pgEnum("lead_delivery_status", ["PENDING", "DELIVERED", "MOCKED", "FAILED", "UNKNOWN"]);
export const leadAttemptStatusEnum = pgEnum("lead_attempt_status", ["DELIVERED", "MOCKED", "FAILED", "UNKNOWN"]);

export const curatedProperties = pgTable("curated_properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  vistaCode: varchar("vista_code", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 160 }).notNull(),
  published: boolean("published").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  featuredOrder: integer("featured_order"),
  publicationPurpose: publicationPurposeEnum("publication_purpose"),
  editorialTitle: varchar("editorial_title", { length: 240 }),
  editorialDescription: text("editorial_description"),
  editorialCoverUrl: text("editorial_cover_url"),
  availabilityConfirmedAt: timestamp("availability_confirmed_at", { withTimezone: true }),
  availabilityExpiresAt: timestamp("availability_expires_at", { withTimezone: true }),
  availabilityConfirmedBy: varchar("availability_confirmed_by", { length: 160 }),
  availabilityConfirmationSource: varchar("availability_confirmation_source", { length: 80 }),
  publicationVersion: integer("publication_version").notNull().default(0),
  lastSyncStatus: varchar("last_sync_status", { length: 20 }).notNull().default("NEVER"),
  lastSyncError: text("last_sync_error"),
  lastSyncAttemptAt: timestamp("last_sync_attempt_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("curated_properties_vista_code_unique").on(table.vistaCode),
  uniqueIndex("curated_properties_slug_unique").on(table.slug),
  index("curated_properties_publication_idx").on(table.published, table.featured, table.featuredOrder),
]);

export const propertySnapshots = pgTable("property_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  curatedPropertyId: uuid("curated_property_id").notNull().references(() => curatedProperties.id, { onDelete: "cascade" }),
  externalCode: varchar("external_code", { length: 80 }).notNull(),
  category: varchar("category", { length: 80 }),
  city: varchar("city", { length: 160 }).notNull(),
  neighborhood: varchar("neighborhood", { length: 160 }).notNull(),
  salePrice: numeric("sale_price", { precision: 14, scale: 2 }),
  rentalPrice: numeric("rental_price", { precision: 14, scale: 2 }),
  privateArea: numeric("private_area", { precision: 12, scale: 2 }),
  totalArea: numeric("total_area", { precision: 12, scale: 2 }),
  bedrooms: integer("bedrooms"),
  suites: integer("suites"),
  parkingSpaces: integer("parking_spaces"),
  coverImageUrl: text("cover_image_url"),
  images: jsonb("images").notNull().default(sql`'[]'::jsonb`),
  characteristics: jsonb("characteristics").notNull().default(sql`'{}'::jsonb`),
  infrastructure: jsonb("infrastructure").notNull().default(sql`'{}'::jsonb`),
  rawCategory: varchar("raw_category", { length: 160 }),
  sourceTitle: varchar("source_title", { length: 300 }),
  sourceDescription: text("source_description"),
  availabilityStatus: availabilityStatusEnum("availability_status").notNull().default("UNKNOWN"),
  sourcePurpose: varchar("source_purpose", { length: 160 }),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  syncStatus: snapshotSyncStatusEnum("sync_status").notNull().default("SUCCESS"),
}, (table) => [
  uniqueIndex("property_snapshots_curated_unique").on(table.curatedPropertyId),
  uniqueIndex("property_snapshots_external_code_unique").on(table.externalCode),
  index("property_snapshots_search_idx").on(table.city, table.neighborhood, table.category),
  index("property_snapshots_availability_idx").on(table.availabilityStatus, table.syncStatus),
]);

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 160 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  published: boolean("published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(0),
}, (table) => [uniqueIndex("collections_slug_unique").on(table.slug)]);

/** Slugs anteriores de coleções, para redirecionamento permanente quando o slug é alterado no painel. */
export const collectionSlugRedirects = pgTable("collection_slug_redirects", {
  oldSlug: varchar("old_slug", { length: 160 }).primaryKey(),
  collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("collection_slug_redirects_collection_idx").on(table.collectionId)]);

export const collectionProperties = pgTable("collection_properties", {
  collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  curatedPropertyId: uuid("curated_property_id").notNull().references(() => curatedProperties.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  uniqueIndex("collection_properties_pair_unique").on(table.collectionId, table.curatedPropertyId),
  index("collection_properties_order_idx").on(table.collectionId, table.sortOrder),
]);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: syncRunStatusEnum("status").notNull().default("RUNNING"),
  totalProcessed: integer("total_processed").notNull().default(0),
  totalSuccess: integer("total_success").notNull().default(0),
  totalFailed: integer("total_failed").notNull().default(0),
  errorSummary: text("error_summary"),
});

export const propertyPublicationEvents = pgTable("property_publication_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  curatedPropertyId: uuid("curated_property_id").notNull().references(() => curatedProperties.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  actor: varchar("actor", { length: 160 }).notNull(),
  details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("property_publication_events_property_idx").on(table.curatedPropertyId, table.createdAt)]);

/**
 * Tabela única de usuários do painel (ADMIN, MANAGER, BROKER). O nome físico "admin_users" foi
 * mantido na Fase 6 para preservar chaves estrangeiras, IDs e sessões existentes.
 */
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  /** Nulo para contas convidadas que ainda não definiram senha. */
  passwordHash: text("password_hash"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  invitationAcceptedAt: timestamp("invitation_accepted_at", { withTimezone: true }),
  /** Incrementada para invalidar sessões JWT emitidas anteriormente. */
  sessionVersion: integer("session_version").notNull().default(0),
  version: integer("version").notNull().default(0),
}, (table) => [uniqueIndex("admin_users_email_unique").on(table.email)]);

/** Alias semântico: a mesma tabela representa todos os usuários. */
export const users = adminUsers;

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 40 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("roles_code_unique").on(table.code)]);

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  assignedBy: uuid("assigned_by").references(() => adminUsers.id, { onDelete: "set null" }),
}, (table) => [primaryKey({ name: "user_roles_pk", columns: [table.userId, table.roleId] }), index("user_roles_role_idx").on(table.roleId)]);

export const userTokens = pgTable("user_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  purpose: varchar("purpose", { length: 20 }).$type<"INVITE" | "PASSWORD_RESET">().notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
}, (table) => [uniqueIndex("user_tokens_hash_unique").on(table.tokenHash), index("user_tokens_user_purpose_idx").on(table.userId, table.purpose)]);

/** Auditoria de acessos. Somente inserção (trigger no banco bloqueia UPDATE e DELETE). */
export const userAuditEvents = pgTable("user_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => adminUsers.id, { onDelete: "restrict" }),
  targetUserId: uuid("target_user_id").notNull().references(() => adminUsers.id, { onDelete: "restrict" }),
  action: varchar("action", { length: 60 }).notNull(),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("user_audit_target_idx").on(table.targetUserId, table.createdAt)]);

export const adminLoginAttempts = pgTable("admin_login_attempts", {
  attemptKey: varchar("attempt_key", { length: 64 }).primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAuditEvents = pgTable("admin_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id").notNull().references(() => adminUsers.id),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  beforeState: jsonb("before_state").notNull().default(sql`'{}'::jsonb`),
  afterState: jsonb("after_state").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("admin_audit_entity_idx").on(table.entityType, table.entityId, table.createdAt)]);

export const adminBulkImports = pgTable("admin_bulk_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id").notNull().references(() => adminUsers.id),
  idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
  requestedCodes: jsonb("requested_codes").notNull().default(sql`'[]'::jsonb`),
  status: varchar("status", { length: 20 }).notNull().default("RUNNING"),
  total: integer("total").notNull().default(0),
  imported: integer("imported").notNull().default(0),
  existing: integer("existing").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  results: jsonb("results").notNull().default(sql`'[]'::jsonb`),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("admin_bulk_imports_idempotency_unique").on(table.adminUserId, table.idempotencyKey),
  index("admin_bulk_imports_admin_idx").on(table.adminUserId, table.startedAt),
]);

export const leadSubmissions = pgTable("lead_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: leadTypeEnum("type").notNull(),
  propertyId: uuid("property_id").references(() => curatedProperties.id, { onDelete: "set null" }),
  propertyVistaCode: varchar("property_vista_code", { length: 80 }),
  vistaVehicle: varchar("vista_vehicle", { length: 200 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  message: text("message"),
  sourcePage: varchar("source_page", { length: 300 }).notNull(),
  deliveryStatus: leadDeliveryStatusEnum("delivery_status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  lastErrorCode: varchar("last_error_code", { length: 80 }),
  submissionKey: varchar("submission_key", { length: 100 }).notNull(),
  deduplicationHash: varchar("deduplication_hash", { length: 64 }).notNull(),
  sessionHash: varchar("session_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("lead_submissions_submission_key_unique").on(table.submissionKey),
  index("lead_submissions_created_idx").on(table.createdAt),
  index("lead_submissions_status_idx").on(table.deliveryStatus, table.createdAt),
  index("lead_submissions_property_idx").on(table.propertyId, table.createdAt),
  index("lead_submissions_deduplication_idx").on(table.deduplicationHash, table.createdAt),
  index("lead_submissions_session_idx").on(table.sessionHash, table.createdAt),
]);

export const leadDeliveryAttempts = pgTable("lead_delivery_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadSubmissionId: uuid("lead_submission_id").notNull().references(() => leadSubmissions.id, { onDelete: "cascade" }),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  status: leadAttemptStatusEnum("status").notNull(),
  errorCode: varchar("error_code", { length: 80 }),
  durationMs: integer("duration_ms").notNull(),
}, (table) => [index("lead_delivery_attempts_lead_idx").on(table.leadSubmissionId, table.attemptedAt)]);

export type CuratedPropertyRow = typeof curatedProperties.$inferSelect;
export type PropertySnapshotRow = typeof propertySnapshots.$inferSelect;
export type AdminUserRow = typeof adminUsers.$inferSelect;
export type LeadSubmissionRow = typeof leadSubmissions.$inferSelect;

/** Perfil profissional do corretor (identidade pública). Autenticação continua em admin_users. */
export const brokerProfiles = pgTable("broker_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => adminUsers.id, { onDelete: "restrict" }),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  professionalTitle: varchar("professional_title", { length: 120 }),
  biography: text("biography"),
  profileImageUrl: text("profile_image_url"),
  whatsapp: varchar("whatsapp", { length: 20 }),
  phone: varchar("phone", { length: 20 }),
  emailPublic: varchar("email_public", { length: 320 }),
  creci: varchar("creci", { length: 20 }),
  creciVerifiedAt: timestamp("creci_verified_at", { withTimezone: true }),
  vistaBrokerCode: varchar("vista_broker_code", { length: 40 }),
  vistaBrokerCodeVerifiedAt: timestamp("vista_broker_code_verified_at", { withTimezone: true }),
  /** Foto enviada pelo painel (media_assets). Tem precedência sobre profileImageUrl. */
  profileImageAssetId: uuid("profile_image_asset_id"),
  specialties: jsonb("specialties").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  serviceRegions: jsonb("service_regions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("broker_profiles_user_unique").on(table.userId)]);

export type BrokerSiteStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "SUSPENDED";

export const brokerSites = pgTable("broker_sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  brokerProfileId: uuid("broker_profile_id").notNull().references(() => brokerProfiles.id, { onDelete: "restrict" }),
  subdomain: varchar("subdomain", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).$type<BrokerSiteStatus>().notNull().default("DRAFT"),
  headline: varchar("headline", { length: 160 }),
  subtitle: varchar("subtitle", { length: 300 }),
  heroImageUrl: text("hero_image_url"),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  submittedForReviewAt: timestamp("submitted_for_review_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by").references(() => adminUsers.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  /** Imagem de apresentação enviada pelo painel (media_assets, kind BROKER_SITE_HERO). */
  heroImageAssetId: uuid("hero_image_asset_id"),
  lastReviewDecision: varchar("last_review_decision", { length: 20 }).$type<"APPROVED" | "RETURNED">(),
  lastReviewNotes: text("last_review_notes"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  lastReviewedBy: uuid("last_reviewed_by"),
  suspensionReason: text("suspension_reason"),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("broker_sites_profile_unique").on(table.brokerProfileId),
  uniqueIndex("broker_sites_subdomain_unique").on(table.subdomain),
  index("broker_sites_status_idx").on(table.status),
]);

export const brokerSiteProperties = pgTable("broker_site_properties", {
  brokerSiteId: uuid("broker_site_id").notNull().references(() => brokerSites.id, { onDelete: "cascade" }),
  curatedPropertyId: uuid("curated_property_id").notNull().references(() => curatedProperties.id, { onDelete: "cascade" }),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: "broker_site_properties_pk", columns: [table.brokerSiteId, table.curatedPropertyId] }),
  index("broker_site_properties_property_idx").on(table.curatedPropertyId),
  index("broker_site_properties_order_idx").on(table.brokerSiteId, table.sortOrder),
]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Mídia enviada pelo painel, armazenada no PostgreSQL. Sempre WebP já tratado pelo servidor. */
export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: varchar("kind", { length: 40 }).$type<"BROKER_PROFILE_PHOTO" | "BROKER_SITE_HERO">().notNull(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  contentType: varchar("content_type", { length: 60 }).$type<"image/webp">().notNull(),
  bytes: bytea("bytes").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("media_assets_owner_idx").on(table.ownerUserId, table.kind)]);

