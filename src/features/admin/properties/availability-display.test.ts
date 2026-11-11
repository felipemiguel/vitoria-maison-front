import { describe, expect, it } from "vitest";
import { availabilityDisplay } from "./availability-display";

const now = new Date("2026-11-07T12:00:00.000Z");

describe("availabilityDisplay", () => {
  it("mostra confirmação manual válida quando o Vista permanece desconhecido", () => {
    expect(availabilityDisplay({ availabilityStatus: "UNKNOWN", availabilityExpiresAt: new Date("2026-11-14T12:00:00.000Z") }, now)).toBe("MANUAL_CONFIRMED");
  });

  it("mostra expiração e preserva indisponibilidade explícita do Vista", () => {
    expect(availabilityDisplay({ availabilityStatus: "UNKNOWN", availabilityExpiresAt: new Date("2026-11-06T12:00:00.000Z") }, now)).toBe("EXPIRED");
    expect(availabilityDisplay({ availabilityStatus: "UNAVAILABLE", availabilityExpiresAt: new Date("2026-11-14T12:00:00.000Z") }, now)).toBe("UNAVAILABLE");
  });
});
