import { describe, expect, it } from "vitest";
import { availabilityDisplay } from "./availability-display";

describe("availabilityDisplay", () => {
  it("mostra a disponibilidade confirmada pela sincronização quando o Vista permanece desconhecido", () => {
    expect(availabilityDisplay({ availabilityStatus: "UNKNOWN", availabilityConfirmedAt: new Date("2026-11-07T12:00:00.000Z") })).toBe("MANUAL_CONFIRMED");
  });

  it("preserva indisponibilidade explícita do Vista e identifica ausência de confirmação", () => {
    expect(availabilityDisplay({ availabilityStatus: "UNKNOWN", availabilityConfirmedAt: null })).toBe("UNKNOWN");
    expect(availabilityDisplay({ availabilityStatus: "UNAVAILABLE", availabilityConfirmedAt: new Date("2026-11-07T12:00:00.000Z") })).toBe("UNAVAILABLE");
  });
});
