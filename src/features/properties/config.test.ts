import { describe, expect, it } from "vitest";
import { getPropertyDataSource, getPublicationPolicyConfig } from "./config";

describe("fonte de dados", () => {
  it("usa mock por padrão", () => expect(getPropertyDataSource({ NODE_ENV: "test" })).toBe("mock"));
  it("aceita database explicitamente", () => expect(getPropertyDataSource({ NODE_ENV: "test", PROPERTY_DATA_SOURCE: "database" })).toBe("database"));
  it("rejeita fonte desconhecida", () => expect(() => getPropertyDataSource({ NODE_ENV: "test", PROPERTY_DATA_SOURCE: "fallback" })).toThrow());
});

describe("política de publicação", () => {
  it("aplica validades seguras por padrão", () => expect(getPublicationPolicyConfig({ NODE_ENV: "test" })).toEqual({ confirmationTtlDays: 7, snapshotMaxAgeHours: 48, defaultState: undefined }));
  it("aceita valores server-side explícitos", () => expect(getPublicationPolicyConfig({ NODE_ENV: "test", AVAILABILITY_CONFIRMATION_TTL_DAYS: "3", PUBLICATION_SNAPSHOT_MAX_AGE_HOURS: "24", PROPERTY_DEFAULT_STATE: "SP" })).toEqual({ confirmationTtlDays: 3, snapshotMaxAgeHours: 24, defaultState: "SP" }));
  it("rejeita valores não positivos", () => expect(() => getPublicationPolicyConfig({ NODE_ENV: "test", AVAILABILITY_CONFIRMATION_TTL_DAYS: "0" })).toThrow());
});
