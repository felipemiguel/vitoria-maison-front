import type { BrokerSiteStatus } from "@/database/schema";

export const BROKER_SITE_STATUS_LABELS: Record<BrokerSiteStatus, string> = { DRAFT: "Rascunho", IN_REVIEW: "Em revisão", PUBLISHED: "Publicado", SUSPENDED: "Suspenso" };

export type BrokerSiteTransition = "SUBMIT" | "APPROVE" | "RETURN_TO_DRAFT" | "SUSPEND" | "REACTIVATE";

/** Máquina de estados. Quem pode executar cada transição é decidido no serviço (permissão + propriedade). */
export const TRANSITIONS: Record<BrokerSiteTransition, { from: readonly BrokerSiteStatus[]; to: BrokerSiteStatus }> = {
  SUBMIT: { from: ["DRAFT"], to: "IN_REVIEW" },
  APPROVE: { from: ["IN_REVIEW"], to: "PUBLISHED" },
  RETURN_TO_DRAFT: { from: ["IN_REVIEW"], to: "DRAFT" },
  SUSPEND: { from: ["DRAFT", "IN_REVIEW", "PUBLISHED"], to: "SUSPENDED" },
  REACTIVATE: { from: ["SUSPENDED"], to: "DRAFT" },
};

export function canTransition(from: BrokerSiteStatus, transition: BrokerSiteTransition): boolean {
  return TRANSITIONS[transition].from.includes(from);
}

/** Somente sites publicados têm conteúdo público. */
export function isPubliclyVisible(status: BrokerSiteStatus): boolean { return status === "PUBLISHED"; }
