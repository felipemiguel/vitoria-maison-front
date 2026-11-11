import { and, eq, gt, gte, inArray, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import { curatedProperties, propertySnapshots } from "@/database/schema";
import type { PublicationPolicyConfig } from "../config";
import type { PublicationDecision, PublicationRecord } from "./types";
import { supportedPublicationTypes } from "./types";

export class PropertyPublicationPolicy {
  constructor(private readonly config: PublicationPolicyConfig) {}

  evaluate(record: PublicationRecord | null, now = new Date(), targetPublished?: boolean): PublicationDecision {
    if (!record) return denied("O imóvel não está selecionado na curadoria.");
    const reasons: string[] = [];
    const published = targetPublished ?? record.published;
    const snapshot = record.snapshot;
    if (!published) reasons.push("O imóvel não possui aprovação editorial para publicação.");
    if (!snapshot) reasons.push("Não existe snapshot comercial válido.");
    if (!record.publicationPurpose) reasons.push("A finalidade editorial não está definida.");
    if (!this.config.defaultState) reasons.push("O estado padrão do imóvel não está configurado.");

    if (snapshot) {
      const maximumAge = this.config.snapshotMaxAgeHours * 60 * 60 * 1_000;
      if (snapshot.syncStatus !== "SUCCESS") reasons.push("O último snapshot comercial não foi sincronizado com sucesso.");
      if (now.getTime() - snapshot.fetchedAt.getTime() > maximumAge) reasons.push("O snapshot comercial está expirado.");
      if (!snapshot.privateArea || Number(snapshot.privateArea) <= 0) reasons.push("A área privativa válida está ausente.");
      if (!snapshot.category || !supportedPublicationTypes.includes(snapshot.category as never)) reasons.push("A categoria do Vista ainda não possui mapeamento público.");
      const price = record.publicationPurpose === "RENT" ? snapshot.rentalPrice : snapshot.salePrice;
      if (!price || Number(price) <= 0) reasons.push("O preço correspondente à finalidade editorial está ausente ou inválido.");
      if (snapshot.availabilityStatus === "UNAVAILABLE") {
        reasons.push("O Vista informou indisponibilidade explícita.");
      } else if (snapshot.availabilityStatus !== "AVAILABLE") {
        if (!record.availabilityConfirmedAt || !record.availabilityExpiresAt || !record.availabilityConfirmedBy || !record.availabilityConfirmationSource || record.availabilityConfirmedAt.getTime() > now.getTime()) {
          reasons.push("A disponibilidade não foi confirmada.");
        } else if (record.availabilityExpiresAt.getTime() <= now.getTime()) {
          reasons.push("A confirmação manual de disponibilidade expirou.");
        }
      }
    }

    const title = record.editorialTitle?.trim() || record.sourceTitle?.trim();
    if (!title) reasons.push("O imóvel não possui título confirmado.");
    const image = record.editorialCoverUrl?.trim() || snapshot?.coverImageUrl?.trim();
    if (!isValidHttpsUrl(image)) reasons.push("O imóvel não possui imagem HTTPS válida.");
    return { allowed: reasons.length === 0, reasons };
  }
}

export function publicVisibilityConditions(now: Date, config: PublicationPolicyConfig): SQL[] {
  if (!config.defaultState) return [sql`false`];
  const freshAfter = new Date(now.getTime() - config.snapshotMaxAgeHours * 60 * 60 * 1_000);
  const selectedPrice = sql`CASE WHEN ${curatedProperties.publicationPurpose} = 'RENT' THEN ${propertySnapshots.rentalPrice} ELSE ${propertySnapshots.salePrice} END`;
  const title = sql`COALESCE(NULLIF(BTRIM(${curatedProperties.editorialTitle}), ''), NULLIF(BTRIM(${propertySnapshots.sourceTitle}), ''))`;
  const cover = sql`COALESCE(NULLIF(BTRIM(${curatedProperties.editorialCoverUrl}), ''), NULLIF(BTRIM(${propertySnapshots.coverImageUrl}), ''))`;
  return [
    eq(curatedProperties.published, true),
    eq(propertySnapshots.syncStatus, "SUCCESS"),
    gte(propertySnapshots.fetchedAt, freshAfter),
    isNotNull(curatedProperties.publicationPurpose),
    sql`${selectedPrice} > 0`,
    sql`${propertySnapshots.privateArea} > 0`,
    inArray(propertySnapshots.category, [...supportedPublicationTypes]),
    sql`${title} IS NOT NULL`,
    sql`${cover} ~ '^https://'`,
    ne(propertySnapshots.availabilityStatus, "UNAVAILABLE"),
    or(
      eq(propertySnapshots.availabilityStatus, "AVAILABLE"),
      and(
        eq(propertySnapshots.availabilityStatus, "UNKNOWN"),
        isNotNull(curatedProperties.availabilityConfirmedAt),
        gt(curatedProperties.availabilityExpiresAt, now),
      ),
    )!,
  ];
}

function denied(reason: string): PublicationDecision { return { allowed: false, reasons: [reason] }; }
function isValidHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
