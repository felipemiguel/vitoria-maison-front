import { createHmac } from "node:crypto";
import { z } from "zod";
import type { LeadAssignmentStatus, LeadDeliveryResult, LeadOrigin, LeadProvider, LeadSubmissionResult, LeadType } from "./types";
import { leadInputSchema } from "./validation";
import { DrizzleLeadStore, DuplicateLeadError, type AssignmentUpdate } from "./drizzle-lead-store";

export class LeadPropertyUnavailableError extends Error {}

export type LeadSubmissionOptions = {
  /** Contrato de atribuição do Vista confirmado: compara o corretor esperado com o retornado. */
  brokerAssignmentVerification?: boolean;
};

/** Mensagem usada quando o visitante não escreve nada (o Vista exige "mensagem"). */
export function defaultLeadMessage(type: LeadType): string {
  if (type === "PROPERTY_INTEREST") return "Tenho interesse neste imóvel.";
  if (type === "INVESTMENT_CONSULTING") return "Gostaria de conversar sobre oportunidades de investimento.";
  if (type === "OWNER_CONTACT") return "Gostaria de conversar sobre o meu imóvel.";
  return "Gostaria de conversar sobre imóveis.";
}

/**
 * Estado de atribuição após uma tentativa de entrega. Regras:
 * - origem Maison: não se aplica;
 * - sem entrega confirmada: continua PENDING;
 * - sem contrato confirmado (flag desligada), sem código do corretor ou sem retorno do Vista: UNVERIFIED;
 * - com contrato confirmado: CONFIRMED se o corretor retornado for o esperado, MISMATCH caso contrário
 *   (inclui cliente já vinculado a outro corretor no Vista).
 */
export function assignmentAfterDelivery(input: { origin: LeadOrigin["source"]; result: LeadDeliveryResult; expectedCode: string | null; verification: boolean }): AssignmentUpdate | undefined {
  if (input.origin !== "BROKER_SITE") return undefined;
  const returnedCode = input.result.brokerCode ?? null;
  let status: LeadAssignmentStatus;
  if (input.result.status !== "DELIVERED" && input.result.status !== "MOCKED") status = "PENDING";
  else if (input.result.status === "MOCKED" || !input.verification || !input.expectedCode || !returnedCode) status = "UNVERIFIED";
  else status = returnedCode === input.expectedCode ? "CONFIRMED" : "MISMATCH";
  return { status, returnedCode };
}

export class LeadSubmissionService {
  constructor(private readonly store: DrizzleLeadStore, private readonly provider: LeadProvider, private readonly secret: string, private readonly now: () => Date = () => new Date(), private readonly options: LeadSubmissionOptions = {}) {}

  async submit(raw: unknown, sessionId: string, origin?: LeadOrigin): Promise<LeadSubmissionResult> {
    const input = leadInputSchema.parse(raw); const now = this.now();
    const resolvedOrigin: LeadOrigin = origin ?? { source: "MAISON_SITE", hostname: null, path: input.sourcePage };
    const brokerSiteId = resolvedOrigin.source === "BROKER_SITE" ? resolvedOrigin.brokerSiteId : undefined;
    if (brokerSiteId && !input.phone) throw new z.ZodError([{ code: "custom", path: ["phone"], message: "Informe seu WhatsApp ou telefone.", input: undefined }]);
    const property = input.type === "PROPERTY_INTEREST" ? await this.store.resolvePublishedProperty(input.propertyId!, now, brokerSiteId) : null;
    if (input.type === "PROPERTY_INTEREST" && !property) throw new LeadPropertyUnavailableError(brokerSiteId ? "Este imóvel não está disponível para contato neste site." : "Este imóvel não está disponível para receber contatos.");
    const message = input.message ?? defaultLeadMessage(input.type);
    const vistaVehicle = property?.vistaCode ?? input.vehicle!;
    const sessionHash = this.hash(`session:${sessionId}`);
    // O site de origem faz parte da deduplicação: o mesmo visitante pode falar com dois corretores diferentes.
    const deduplicationHash = this.hash([input.type, brokerSiteId ?? "", property?.id ?? "", vistaVehicle.toLowerCase(), input.email?.toLowerCase() ?? "", input.phone?.replace(/\D/g, "") ?? "", message.toLowerCase()].join("|"));
    let created;
    try { created = await this.store.create({ type: input.type, propertyId: property?.id ?? null, propertyVistaCode: property?.vistaCode ?? null, vistaVehicle, name: input.name, email: input.email, phone: input.phone, message, sourcePage: input.sourcePage, submissionKey: input.submissionKey, deduplicationHash, sessionHash, origin: resolvedOrigin }, now); }
    catch (error) { if (error instanceof DuplicateLeadError) return { id: error.existingId, status: error.status, message: "Já recebemos esta solicitação recentemente." }; throw error; }
    if (!created.created) return { id: created.id, status: created.status, message: messageFor(created.status) };
    console.info(JSON.stringify({ level: "info", event: "lead.received", leadId: created.id, type: input.type, source: resolvedOrigin.source }));
    const expectedCode = resolvedOrigin.source === "BROKER_SITE" ? resolvedOrigin.vistaBrokerCode : null;
    const started = Date.now();
    const lead = { id: created.id, type: input.type, name: input.name, email: input.email, phone: input.phone, message, sourcePage: input.sourcePage, propertyId: property?.id ?? null, propertyVistaCode: property?.vistaCode ?? null, vistaVehicle, vistaBrokerCode: expectedCode };
    let result: LeadDeliveryResult;
    try { result = await this.provider.sendLead(lead); } catch { result = { status: "FAILED", errorCode: "PROVIDER_ERROR" }; }
    const assignment = assignmentAfterDelivery({ origin: resolvedOrigin.source, result, expectedCode, verification: Boolean(this.options.brokerAssignmentVerification) });
    await this.store.recordDelivery(created.id, result, Date.now() - started, now, assignment);
    console.info(JSON.stringify({ level: "info", event: "lead.delivery.completed", leadId: created.id, status: result.status, errorCode: result.errorCode, assignment: assignment?.status }));
    return { id: created.id, status: result.status, message: messageFor(result.status) };
  }
  private hash(value: string) { return createHmac("sha256", this.secret).update(value).digest("hex"); }
}

/** Nunca afirma que o lead chegou ao corretor: a confirmação ao visitante é sempre da equipe Vitória Maison. */
function messageFor(status: string): string { if (status === "DELIVERED") return "Recebemos seu interesse. Nossa equipe entrará em contato."; if (status === "MOCKED") return "Sua solicitação foi registrada com segurança no ambiente de testes."; if (status === "UNKNOWN") return "Sua solicitação foi registrada e está aguardando confirmação de entrega."; if (status === "FAILED") return "Sua solicitação foi registrada, mas a entrega está pendente. Nossa equipe poderá processá-la novamente."; return "Sua solicitação já foi registrada."; }
