import type { Property } from "@/features/properties/types";
import { getSeoConfig, type SeoConfig } from "./config";

/** Fixtures fictícias para testes. Nenhum dado real ou credencial. */
export const productionEnv = {
  SITE_INDEXING_ENABLED: "true",
  NEXT_PUBLIC_SITE_URL: "https://www.vitoria-maison.test",
  PROPERTY_DATA_SOURCE: "database",
  NODE_ENV: "production",
};

export function indexableConfig(overrides: Partial<Record<string, string>> = {}): SeoConfig {
  return getSeoConfig({ ...productionEnv, ...overrides });
}

export function blockedConfig(): SeoConfig {
  return getSeoConfig({ ...productionEnv, SITE_INDEXING_ENABLED: "false" });
}

export function propertyFixture(overrides: Partial<Property> = {}): Property {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    externalId: "12345678",
    slug: "vista-12345678",
    commercial: { purpose: "SALE", type: "FLAT", price: 780000, area: 48, bedrooms: 1, code: "12345678" },
    location: { neighborhood: "Moema", city: "São Paulo", state: "SP" },
    editorial: {
      title: "Flat com luz natural",
      description: "Texto de origem.",
      descriptionSource: "source",
      images: [{ url: "https://cdn.fotos.test/vitoria/1.jpg", alt: "Sala" }, { url: "https://cdn.fotos.test/vitoria/2.jpg", alt: "Quarto" }],
      features: [],
    },
    curation: { published: true, featured: false, collections: [] },
    ...overrides,
  };
}
