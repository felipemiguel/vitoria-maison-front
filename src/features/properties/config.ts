import { z } from "zod";

const sourceSchema = z.enum(["mock", "database"]);
export type PropertyDataSource = z.infer<typeof sourceSchema>;

export function getPropertyDataSource(env: NodeJS.ProcessEnv = process.env): PropertyDataSource {
  return sourceSchema.parse(env.PROPERTY_DATA_SOURCE ?? "mock");
}

const positiveInteger = z.coerce.number().int().positive();

export type PublicationPolicyConfig = {
  confirmationTtlDays: number;
  snapshotMaxAgeHours: number;
  defaultState?: string;
};

export function getPublicationPolicyConfig(env: NodeJS.ProcessEnv = process.env): PublicationPolicyConfig {
  return {
    confirmationTtlDays: positiveInteger.parse(env.AVAILABILITY_CONFIRMATION_TTL_DAYS ?? 7),
    snapshotMaxAgeHours: positiveInteger.parse(env.PUBLICATION_SNAPSHOT_MAX_AGE_HOURS ?? 48),
    defaultState: env.PROPERTY_DEFAULT_STATE?.trim() || undefined,
  };
}
