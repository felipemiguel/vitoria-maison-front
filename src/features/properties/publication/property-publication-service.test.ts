import { describe, expect, it, vi } from "vitest";
import type { ManualAvailabilityConfirmation, PropertyPublicationStore, PublicationRecord } from "./types";
import { PropertyPublicationService } from "./property-publication-service";

const now = new Date("2026-11-06T12:00:00.000Z");

function record(): PublicationRecord {
  return {
    id: "id-1", vistaCode: "31", updatedAt: now, publicationVersion: 0, published: false,
    publicationPurpose: "SALE", editorialTitle: null, sourceTitle: "Imóvel fictício", editorialCoverUrl: null,
    availabilityConfirmedAt: now, availabilityExpiresAt: new Date("2026-11-13T12:00:00.000Z"),
    availabilityConfirmedBy: "tester", availabilityConfirmationSource: "MANUAL_CLI",
    snapshot: { syncStatus: "SUCCESS", availabilityStatus: "UNKNOWN", fetchedAt: now, salePrice: "1000000", rentalPrice: null, privateArea: "80", category: "APARTMENT", coverImageUrl: "https://images.example.test/31.jpg" },
  };
}

class MemoryPublicationStore implements PropertyPublicationStore {
  current: PublicationRecord | null = record();
  async load() { return this.current; }
  async confirmAvailability(_code: string, expectedVersion: number, confirmation: ManualAvailabilityConfirmation) {
    if (!this.current || this.current.publicationVersion !== expectedVersion) return false;
    this.current = { ...this.current, publicationVersion: expectedVersion + 1, availabilityConfirmedAt: confirmation.confirmedAt, availabilityExpiresAt: confirmation.expiresAt, availabilityConfirmedBy: confirmation.confirmedBy, availabilityConfirmationSource: confirmation.source };
    return true;
  }
  async clearAvailabilityConfirmation(_code: string, expectedVersion: number) {
    if (!this.current || this.current.publicationVersion !== expectedVersion) return false;
    this.current = { ...this.current, publicationVersion: expectedVersion + 1, availabilityConfirmedAt: null, availabilityExpiresAt: null, availabilityConfirmedBy: null, availabilityConfirmationSource: null };
    return true;
  }
  async setPublished(_code: string, published: boolean, expectedVersion: number) {
    if (!this.current || this.current.publicationVersion !== expectedVersion) return false;
    this.current = { ...this.current, published, publicationVersion: expectedVersion + 1 };
    return true;
  }
}

function create(store = new MemoryPublicationStore(), invalidate = vi.fn(async () => undefined)) {
  return { store, invalidate, service: new PropertyPublicationService(store, { confirmationTtlDays: 7, snapshotMaxAgeHours: 48, defaultState: "SP" }, invalidate) };
}

describe("PropertyPublicationService", () => {
  it("publica somente depois de reavaliar todas as regras", async () => {
    const { service, store } = create();
    expect(await service.publish("31", now)).toEqual({ allowed: true, reasons: [] });
    expect(store.current?.published).toBe(true);
  });

  it("não publica quando há bloqueios", async () => {
    const { service, store } = create();
    store.current = { ...record(), publicationPurpose: null };
    expect((await service.publish("31", now)).allowed).toBe(false);
    expect(store.current.published).toBe(false);
  });

  it("despublica sem apagar snapshot e é idempotente", async () => {
    const { service, store } = create();
    store.current = { ...record(), published: true };
    const originalSnapshot = store.current.snapshot;
    await service.unpublish("31");
    await service.unpublish("31");
    expect(store.current?.published).toBe(false);
    expect(store.current?.snapshot).toBe(originalSnapshot);
  });

  it("registra confirmação temporária sem publicar", async () => {
    const { service, store } = create();
    store.current = { ...record(), availabilityConfirmedAt: null, availabilityExpiresAt: null };
    const result = await service.confirmAvailability("31", "operador.teste", now);
    expect(result.expiresAt.toISOString()).toBe("2026-11-13T12:00:00.000Z");
    expect(store.current?.availabilityConfirmedBy).toBe("operador.teste");
    expect(store.current?.published).toBe(false);
  });

  it("não permite confirmação manual contra indisponibilidade do Vista", async () => {
    const { service, store } = create();
    store.current = { ...record(), snapshot: { ...record().snapshot!, availabilityStatus: "UNAVAILABLE" } };
    await expect(service.confirmAvailability("31", "operador.teste", now)).rejects.toThrow(/indisponibilidade explícita/);
  });

  it("remove a confirmação manual quando a disponibilidade volta a não confirmada", async () => {
    const { service, store } = create();
    await service.clearAvailabilityConfirmation("31", "operador.teste", now);
    expect(store.current?.availabilityConfirmedAt).toBeNull();
    expect(store.current?.availabilityExpiresAt).toBeNull();
    expect(store.current?.availabilityConfirmedBy).toBeNull();
  });

  it("invalida a camada pública após confirmação, publicação e despublicação", async () => {
    const { service, store, invalidate } = create();
    store.current = { ...record(), availabilityConfirmedAt: null, availabilityExpiresAt: null };
    await service.confirmAvailability("31", "operador.teste", now);
    await service.publish("31", now);
    await service.unpublish("31");
    await service.clearAvailabilityConfirmation("31", "operador.teste", now);
    expect(invalidate).toHaveBeenCalledTimes(4);
  });
});
