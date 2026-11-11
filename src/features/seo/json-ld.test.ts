import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, collectionPageJsonLd, organizationJsonLd, propertyListingJsonLd, serializeJsonLd, websiteJsonLd } from "./json-ld";
import { getSeoConfig } from "./config";
import { indexableConfig, propertyFixture } from "./fixtures";

const ALLOWED_TYPES = new Set(["Organization", "ContactPoint", "PropertyValue", "RealEstateAgent", "WebSite", "BreadcrumbList", "ListItem", "RealEstateListing", "Offer", "Apartment", "QuantitativeValue", "PostalAddress", "City", "CollectionPage", "ItemList"]);

function collectTypes(value: unknown, types: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => collectTypes(item, types));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) { if (key === "@type") types.push(String(item)); else collectTypes(item, types); }
  }
  return types;
}

describe("JSON-LD", () => {
  const config = indexableConfig();

  it("usa somente tipos Schema.org conhecidos", () => {
    const all = [organizationJsonLd(config), websiteJsonLd(config), propertyListingJsonLd(propertyFixture(), config), breadcrumbJsonLd([{ name: "Início", path: "/" }], config), collectionPageJsonLd({ name: "Jardins", slug: "jardins", description: "x", propertySlugs: ["a"] }, config)];
    for (const type of collectTypes(all)) expect(ALLOWED_TYPES.has(type), type).toBe(true);
  });

  it("organização com os dados oficiais do rodapé, sem avaliações ou coordenadas", () => {
    const org = organizationJsonLd(config)!;
    expect(org).toMatchObject({
      "@type": "RealEstateAgent", name: "Vitória Maison", url: "https://www.vitoria-maison.test/",
      telephone: "+551130851381", email: "atendimento@vitoriaflats.com.br",
      address: { "@type": "PostalAddress", streetAddress: "Alameda Santos, 1.165, Sala 11", addressLocality: "São Paulo", addressRegion: "SP", postalCode: "01419-002", addressCountry: "BR" },
      identifier: { propertyID: "CRECI", value: "38157-J" },
      parentOrganization: { name: "Grupo Vitória Flats" },
    });
    expect(org.contactPoint).toHaveLength(2);
    for (const key of ["geo", "aggregateRating", "review"]) expect(org).not.toHaveProperty(key);
  });

  it("imóvel publicado: preço real, sem disponibilidade nem endereço exato", () => {
    const listing = propertyListingJsonLd(propertyFixture(), config)!;
    expect(listing).toMatchObject({ "@type": "RealEstateListing", url: "https://www.vitoria-maison.test/imoveis/vista-12345678" });
    expect(listing.offers).toMatchObject({ price: 780000, priceCurrency: "BRL" });
    const text = JSON.stringify(listing);
    expect(text).not.toMatch(/availability|InStock|streetAddress|postalCode|latitude|geo|aggregateRating/);
  });

  it("não declara oferta quando o preço está ausente", () => {
    const listing = propertyListingJsonLd(propertyFixture({ commercial: { ...propertyFixture().commercial, price: 0 } }), config)!;
    expect(listing).not.toHaveProperty("offers");
  });

  it("não emite JSON-LD sem URL canônica configurada", () => {
    const noUrl = getSeoConfig({});
    expect(organizationJsonLd(noUrl)).toBeNull();
    expect(propertyListingJsonLd(propertyFixture(), noUrl)).toBeNull();
    expect(breadcrumbJsonLd([{ name: "Início", path: "/" }], noUrl)).toBeNull();
  });

  it("serializa sem permitir fechamento da tag script", () => {
    const text = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script>" });
  });

  it("breadcrumb com posições sequenciais e URLs absolutas", () => {
    const crumbs = breadcrumbJsonLd([{ name: "Início", path: "/" }, { name: "Imóveis", path: "/imoveis" }], config)!;
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Início", item: "https://www.vitoria-maison.test/" },
      { "@type": "ListItem", position: 2, name: "Imóveis", item: "https://www.vitoria-maison.test/imoveis" },
    ]);
  });
});
