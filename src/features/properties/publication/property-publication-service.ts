import type { PublicationPolicyConfig } from "../config";
import { PropertyPublicationPolicy } from "./property-publication-policy";
import type { PropertyPublicationStore, PublicationDecision, PublicationRecord } from "./types";

export type PropertyPublicationStatus = {
  code: string;
  selected: boolean;
  published: boolean;
  availability: {
    vista: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
    confirmedAt: Date | null;
    expiresAt: Date | null;
    confirmedBy: string | null;
  };
  snapshotFetchedAt: Date | null;
  currentDecision: PublicationDecision;
  publishDecision: PublicationDecision;
};

export class PropertyPublicationService {
  private readonly policy: PropertyPublicationPolicy;

  constructor(
    private readonly store: PropertyPublicationStore,
    private readonly config: PublicationPolicyConfig,
    private readonly invalidatePublicCache: () => Promise<void> = async () => undefined,
  ) { this.policy = new PropertyPublicationPolicy(config); }

  async validate(code: string, now = new Date()): Promise<PublicationDecision> {
    return this.policy.evaluate(await this.store.load(code), now, true);
  }

  async status(code: string, now = new Date()): Promise<PropertyPublicationStatus> {
    const record = await this.store.load(code);
    return {
      code,
      selected: Boolean(record),
      published: record?.published ?? false,
      availability: {
        vista: record?.snapshot?.availabilityStatus ?? "UNKNOWN",
        confirmedAt: record?.availabilityConfirmedAt ?? null,
        expiresAt: record?.availabilityExpiresAt ?? null,
        confirmedBy: record?.availabilityConfirmedBy ?? null,
      },
      snapshotFetchedAt: record?.snapshot?.fetchedAt ?? null,
      currentDecision: this.policy.evaluate(record, now),
      publishDecision: this.policy.evaluate(record, now, true),
    };
  }

  async confirmAvailability(code: string, operator: string, now = new Date(), source: "MANUAL_CLI" | "MANUAL_ADMIN" = "MANUAL_CLI"): Promise<{ expiresAt: Date }> {
    const normalizedOperator = operator.trim();
    if (!normalizedOperator) throw new Error("O operador é obrigatório.");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const record = await this.requireRecord(code);
      if (!record.snapshot) throw new Error("Não existe snapshot comercial válido.");
      if (record.snapshot.availabilityStatus === "UNAVAILABLE") throw new Error("O Vista informou indisponibilidade explícita; confirmação manual bloqueada.");
      if (record.snapshot.availabilityStatus === "AVAILABLE") throw new Error("O Vista já confirmou a disponibilidade; confirmação manual não é necessária.");
      const expiresAt = new Date(now.getTime() + this.config.confirmationTtlDays * 24 * 60 * 60 * 1_000);
      const changed = await this.store.confirmAvailability(code, record.publicationVersion, {
        confirmedAt: now, expiresAt, confirmedBy: normalizedOperator, source,
      });
      if (changed) { await this.invalidatePublicCache(); return { expiresAt }; }
    }
    throw new Error("O imóvel foi alterado simultaneamente; tente confirmar novamente.");
  }

  async clearAvailabilityConfirmation(code: string, operator: string, now = new Date()): Promise<void> {
    const normalizedOperator = operator.trim();
    if (!normalizedOperator) throw new Error("O operador é obrigatório.");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const record = await this.requireRecord(code);
      if (!record.availabilityConfirmedAt && !record.availabilityExpiresAt) return;
      if (await this.store.clearAvailabilityConfirmation(code, record.publicationVersion, normalizedOperator, now)) {
        await this.invalidatePublicCache();
        return;
      }
    }
    throw new Error("O imóvel foi alterado simultaneamente; tente atualizar a disponibilidade novamente.");
  }

  async publish(code: string, now = new Date(), actor = "server-cli"): Promise<PublicationDecision> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const record = await this.store.load(code);
      const decision = this.policy.evaluate(record, now, true);
      if (!decision.allowed) return decision;
      if (record!.published) return decision;
      if (await this.store.setPublished(code, true, record!.publicationVersion, actor, { before: { published: false }, after: { published: true } })) {
        await this.invalidatePublicCache();
        return decision;
      }
    }
    return { allowed: false, reasons: ["O imóvel foi alterado simultaneamente; tente publicar novamente."] };
  }

  async unpublish(code: string, actor = "server-cli"): Promise<{ unpublished: boolean }> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const record = await this.requireRecord(code);
      if (!record.published) return { unpublished: true };
      if (await this.store.setPublished(code, false, record.publicationVersion, actor, { before: { published: true }, after: { published: false } })) {
        await this.invalidatePublicCache();
        return { unpublished: true };
      }
    }
    throw new Error("O imóvel foi alterado simultaneamente; tente despublicar novamente.");
  }

  private async requireRecord(code: string): Promise<PublicationRecord> {
    const record = await this.store.load(code);
    if (!record) throw new Error("O imóvel não está selecionado na curadoria.");
    return record;
  }
}
