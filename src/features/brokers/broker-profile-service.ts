import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminUsers, brokerProfiles, mediaAssets, roles, userAuditEvents, userRoles } from "@/database/schema";
import { processProfilePhoto } from "@/features/media/image-processing";
import { ForbiddenError } from "@/features/access/errors";
import { hasPermission, type AccessSubject, type Permission } from "@/features/access/permissions";
import { isUniqueViolation } from "@/features/users/errors";
import { BrokerError } from "./errors";
import { brokerProfileSchema } from "./validation";

type Db = NodePgDatabase<typeof schema>;
export type BrokerActor = AccessSubject & { id: string };
export type BrokerProfile = typeof brokerProfiles.$inferSelect;

/**
 * Perfil profissional do corretor. Existe somente para usuários com o perfil BROKER e nunca é
 * criado automaticamente. Dados de autenticação permanecem em admin_users.
 */
export class BrokerProfileService {
  constructor(private readonly db: Db, private readonly imageHosts: string[], private readonly now: () => Date = () => new Date()) {}

  async getOwn(actor: BrokerActor): Promise<BrokerProfile | null> {
    this.assert(actor, "broker-profile:read-own");
    return this.findByUser(actor.id);
  }

  async getForUser(actor: BrokerActor, userId: string): Promise<BrokerProfile | null> {
    if (actor.id !== userId) this.assert(actor, "broker-site:manage-all"); else this.assert(actor, "broker-profile:read-own");
    return this.findByUser(userId);
  }

  async createOwn(actor: BrokerActor, input: unknown): Promise<BrokerProfile> {
    this.assert(actor, "broker-profile:update-own");
    return this.create(actor.id, actor.id, input);
  }

  /** ADMIN pode criar o perfil de um corretor; o usuário alvo precisa estar ativo e ter o perfil BROKER. */
  async createForUser(actor: BrokerActor, userId: string, input: unknown): Promise<BrokerProfile> {
    this.assert(actor, "broker-site:manage-all");
    return this.create(actor.id, userId, input);
  }

  async updateOwn(actor: BrokerActor, input: unknown): Promise<BrokerProfile> {
    this.assert(actor, "broker-profile:update-own");
    const data = brokerProfileSchema(this.imageHosts).parse(input);
    return this.db.transaction(async (tx) => {
      const before = (await tx.select().from(brokerProfiles).where(eq(brokerProfiles.userId, actor.id)).for("update").limit(1))[0];
      if (!before) throw new BrokerError("Crie seu perfil profissional primeiro.");
      if (!(await this.userIsActiveBroker(tx, actor.id))) throw new ForbiddenError(["broker-profile:update-own"]);
      // Alterar o CRECI é uma solicitação: o valor fica sem verificação até a equipe conferir.
      const creciChanged = (data.creci ?? null) !== before.creci;
      const updated = (await tx.update(brokerProfiles).set({
        ...this.columns(data, false), updatedAt: this.now(),
        ...(creciChanged ? { creciVerifiedAt: null } : {}),
      }).where(eq(brokerProfiles.id, before.id)).returning())[0];
      await tx.insert(userAuditEvents).values({ actorUserId: actor.id, targetUserId: actor.id, action: "BROKER_PROFILE_UPDATED", metadata: { creciChanged } });
      if (creciChanged) await tx.insert(userAuditEvents).values({ actorUserId: actor.id, targetUserId: actor.id, action: "BROKER_CRECI_CHANGE_REQUESTED", metadata: { hasValue: Boolean(data.creci) } });
      return updated;
    });
  }

  /**
   * Atestado administrativo de que CRECI e/ou código Vista foram conferidos. Preencher o campo
   * não basta: o código do Vista só é considerado válido após esta verificação.
   */
  async verifyProfessionalData(actor: BrokerActor, profileId: string, fields: { creci?: boolean; vistaBrokerCode?: boolean }): Promise<void> {
    this.assert(actor, "broker-site:manage-all");
    const profile = (await this.db.select().from(brokerProfiles).where(eq(brokerProfiles.id, profileId)).limit(1))[0];
    if (!profile) throw new BrokerError("Perfil não encontrado.");
    if (fields.creci && !profile.creci) throw new BrokerError("O CRECI não foi informado.");
    if (fields.vistaBrokerCode && !profile.vistaBrokerCode) throw new BrokerError("O código do Vista não foi informado.");
    const now = this.now();
    await this.db.update(brokerProfiles).set({ ...(fields.creci ? { creciVerifiedAt: now } : {}), ...(fields.vistaBrokerCode ? { vistaBrokerCodeVerifiedAt: now } : {}), updatedAt: now }).where(eq(brokerProfiles.id, profileId));
    await this.db.insert(userAuditEvents).values({ actorUserId: actor.id, targetUserId: profile.userId, action: "BROKER_PROFESSIONAL_DATA_VERIFIED", metadata: { creci: Boolean(fields.creci), vistaBrokerCode: Boolean(fields.vistaBrokerCode) } });
  }

  /**
   * Foto profissional enviada pelo painel. O próprio corretor (update-own) ou um ADMIN (manage-all).
   * A imagem é validada e tratada antes de gravar; a foto anterior é apagada.
   */
  async setPhoto(actor: BrokerActor, input: Buffer, targetUserId: string = actor.id): Promise<{ assetId: string }> {
    this.assertPhotoAccess(actor, targetUserId);
    const image = await processProfilePhoto(input);
    return this.db.transaction(async (tx) => {
      const profile = (await tx.select().from(brokerProfiles).where(eq(brokerProfiles.userId, targetUserId)).for("update").limit(1))[0];
      if (!profile) throw new BrokerError("Crie o perfil profissional antes de enviar a foto.");
      const asset = (await tx.insert(mediaAssets).values({ kind: "BROKER_PROFILE_PHOTO", ownerUserId: targetUserId, contentType: image.contentType, bytes: image.bytes, sizeBytes: image.sizeBytes, width: image.width, height: image.height, sha256: image.sha256, createdBy: actor.id }).returning({ id: mediaAssets.id }))[0];
      await tx.update(brokerProfiles).set({ profileImageAssetId: asset.id, profileImageUrl: null, updatedAt: this.now() }).where(eq(brokerProfiles.id, profile.id));
      if (profile.profileImageAssetId) await tx.delete(mediaAssets).where(eq(mediaAssets.id, profile.profileImageAssetId));
      await tx.insert(userAuditEvents).values({ actorUserId: actor.id, targetUserId, action: "BROKER_PROFILE_PHOTO_UPDATED", metadata: { sizeBytes: image.sizeBytes, width: image.width, height: image.height } });
      return { assetId: asset.id };
    });
  }

  async removePhoto(actor: BrokerActor, targetUserId: string = actor.id): Promise<void> {
    this.assertPhotoAccess(actor, targetUserId);
    await this.db.transaction(async (tx) => {
      const profile = (await tx.select().from(brokerProfiles).where(eq(brokerProfiles.userId, targetUserId)).for("update").limit(1))[0];
      if (!profile) throw new BrokerError("Perfil não encontrado.");
      await tx.update(brokerProfiles).set({ profileImageAssetId: null, profileImageUrl: null, updatedAt: this.now() }).where(eq(brokerProfiles.id, profile.id));
      if (profile.profileImageAssetId) await tx.delete(mediaAssets).where(eq(mediaAssets.id, profile.profileImageAssetId));
      await tx.insert(userAuditEvents).values({ actorUserId: actor.id, targetUserId, action: "BROKER_PROFILE_PHOTO_REMOVED", metadata: {} });
    });
  }

  private assertPhotoAccess(actor: BrokerActor, targetUserId: string): void {
    if (targetUserId === actor.id) this.assert(actor, "broker-profile:update-own"); else this.assert(actor, "broker-site:manage-all");
  }

  /** Código de corretor no Vista: somente ADMIN configura (e, ao configurar, atesta a verificação). */
  async setVistaBrokerCode(actor: BrokerActor, profileId: string, rawCode: unknown): Promise<void> {
    this.assert(actor, "broker-site:manage-all");
    const code = typeof rawCode === "string" && rawCode.trim() ? rawCode.trim() : null;
    if (code && !/^[A-Za-z0-9._-]{1,40}$/.test(code)) throw new BrokerError("Código do Vista inválido.");
    const profile = (await this.db.select().from(brokerProfiles).where(eq(brokerProfiles.id, profileId)).limit(1))[0];
    if (!profile) throw new BrokerError("Perfil não encontrado.");
    await this.db.update(brokerProfiles).set({ vistaBrokerCode: code, vistaBrokerCodeVerifiedAt: code ? this.now() : null, updatedAt: this.now() }).where(eq(brokerProfiles.id, profileId));
    await this.db.insert(userAuditEvents).values({ actorUserId: actor.id, targetUserId: profile.userId, action: "BROKER_VISTA_CODE_SET", metadata: { hasValue: Boolean(code) } });
  }

  async getById(actor: BrokerActor, profileId: string): Promise<BrokerProfile | null> {
    this.assert(actor, "broker-site:manage-all");
    return (await this.db.select().from(brokerProfiles).where(eq(brokerProfiles.id, profileId)).limit(1))[0] ?? null;
  }

  private async create(actorId: string, userId: string, input: unknown): Promise<BrokerProfile> {
    const data = brokerProfileSchema(this.imageHosts).parse(input);
    try {
      return await this.db.transaction(async (tx) => {
        if (!(await this.userIsActiveBroker(tx, userId))) throw new BrokerError("O perfil profissional exige um usuário ativo com o perfil Corretor.");
        if ((await tx.select({ id: brokerProfiles.id }).from(brokerProfiles).where(eq(brokerProfiles.userId, userId)).limit(1))[0]) throw new BrokerError("Este usuário já possui perfil profissional.");
        const now = this.now();
        // Na criação pelo próprio corretor, o código Vista é ignorado (somente ADMIN configura).
        const created = (await tx.insert(brokerProfiles).values({ userId, ...this.columns(data, actorId !== userId), createdAt: now, updatedAt: now }).returning())[0];
        await tx.insert(userAuditEvents).values({ actorUserId: actorId, targetUserId: userId, action: "BROKER_PROFILE_CREATED", metadata: {} });
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new BrokerError("Este usuário já possui perfil profissional.");
      throw error;
    }
  }

  private columns(data: ReturnType<ReturnType<typeof brokerProfileSchema>["parse"]>, includeVistaCode: boolean) {
    return {
      displayName: data.displayName, professionalTitle: data.professionalTitle ?? null, biography: data.biography ?? null,
      ...(data.profileImageUrl !== undefined ? { profileImageUrl: data.profileImageUrl ?? null } : {}), whatsapp: data.whatsapp ?? null, phone: data.phone ?? null,
      emailPublic: data.emailPublic ?? null, creci: data.creci ?? null,
      ...(includeVistaCode ? { vistaBrokerCode: data.vistaBrokerCode ?? null } : {}),
      specialties: data.specialties, serviceRegions: data.serviceRegions,
    };
  }

  private async findByUser(userId: string): Promise<BrokerProfile | null> {
    return (await this.db.select().from(brokerProfiles).where(eq(brokerProfiles.userId, userId)).limit(1))[0] ?? null;
  }

  private async userIsActiveBroker(tx: Pick<Db, "select">, userId: string): Promise<boolean> {
    const rows = await tx.select({ one: sql`1` }).from(adminUsers)
      .innerJoin(userRoles, eq(userRoles.userId, adminUsers.id)).innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(adminUsers.id, userId), eq(adminUsers.active, true), eq(roles.code, "BROKER"))).limit(1);
    return rows.length > 0;
  }

  private assert(actor: BrokerActor, permission: Permission): void {
    if (!hasPermission(actor, permission)) throw new ForbiddenError([permission]);
  }
}
