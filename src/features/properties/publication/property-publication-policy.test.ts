import { describe, expect, it } from "vitest";
import type { PublicationRecord } from "./types";
import { PropertyPublicationPolicy } from "./property-publication-policy";

const now = new Date("2026-11-06T12:00:00.000Z");
const policy = new PropertyPublicationPolicy({ confirmationTtlDays: 7, snapshotMaxAgeHours: 48, defaultState: "SP" });

function eligible(overrides: Partial<PublicationRecord> = {}): PublicationRecord {
  return {
    id: "property-1", vistaCode: "VM-1", updatedAt: now, publicationVersion: 0,
    published: true, publicationPurpose: "SALE", editorialTitle: "Apartamento fictício", sourceTitle: null,
    editorialCoverUrl: null, availabilityConfirmedAt: now,
    availabilityExpiresAt: new Date("2026-11-13T12:00:00.000Z"), availabilityConfirmedBy: "operador.teste",
    availabilityConfirmationSource: "MANUAL_CLI",
    snapshot: {
      syncStatus: "SUCCESS", availabilityStatus: "UNKNOWN", fetchedAt: now,
      salePrice: "1200000.00", rentalPrice: null, privateArea: "82.00", category: "APARTMENT",
      coverImageUrl: "https://images.example.test/property.jpg",
    },
    ...overrides,
  };
}

describe("PropertyPublicationPolicy", () => {
  it("bloqueia imóvel não selecionado", () => expect(policy.evaluate(null, now).reasons).toContain("O imóvel não está selecionado na curadoria."));
  it("bloqueia imóvel sem snapshot", () => expect(policy.evaluate(eligible({ snapshot: null }), now).reasons).toContain("Não existe snapshot comercial válido."));
  it("bloqueia imóvel sem finalidade", () => expect(policy.evaluate(eligible({ publicationPurpose: null }), now).reasons).toContain("A finalidade editorial não está definida."));
  it("bloqueia imóvel sem preço válido", () => expect(policy.evaluate(eligible({ snapshot: { ...eligible().snapshot!, salePrice: "0" } }), now).reasons).toContain("O preço correspondente à finalidade editorial está ausente ou inválido."));
  it("bloqueia disponibilidade desconhecida sem confirmação", () => expect(policy.evaluate(eligible({ availabilityConfirmedAt: null, availabilityExpiresAt: null }), now).reasons).toContain("A disponibilidade não foi confirmada."));
  it("aceita confirmação manual válida", () => expect(policy.evaluate(eligible(), now)).toEqual({ allowed: true, reasons: [] }));
  it("bloqueia confirmação manual expirada", () => expect(policy.evaluate(eligible({ availabilityExpiresAt: new Date("2026-11-06T11:59:59.000Z") }), now).reasons).toContain("A confirmação manual de disponibilidade expirou."));
  it("indisponibilidade do Vista prevalece sobre confirmação manual", () => expect(policy.evaluate(eligible({ snapshot: { ...eligible().snapshot!, availabilityStatus: "UNAVAILABLE" } }), now).reasons).toContain("O Vista informou indisponibilidade explícita."));
  it("aceita disponibilidade explícita do Vista sem confirmação manual", () => expect(policy.evaluate(eligible({ availabilityConfirmedAt: null, availabilityExpiresAt: null, snapshot: { ...eligible().snapshot!, availabilityStatus: "AVAILABLE" } }), now).allowed).toBe(true));
  it("bloqueia snapshot expirado", () => expect(policy.evaluate(eligible({ snapshot: { ...eligible().snapshot!, fetchedAt: new Date("2026-11-04T11:59:59.000Z") } }), now).reasons).toContain("O snapshot comercial está expirado."));
  it("bloqueia acesso direto quando published é false", () => expect(policy.evaluate(eligible({ published: false }), now).allowed).toBe(false));
  it("permite validar o alvo de publicação sem alterar a flag", () => expect(policy.evaluate(eligible({ published: false }), now, true).allowed).toBe(true));
});
