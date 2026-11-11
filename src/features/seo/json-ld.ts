import type { Property } from "@/features/properties/types";
import { BRAND_LOGO_PATH, BRAND_NAME, SITE_DESCRIPTION, SITE_LANGUAGE, absoluteUrl, isHttpsUrl, type SeoConfig } from "./config";
import { companyInfo } from "@/lib/config/company";
import { PROPERTY_TYPE_LABEL, propertySeoDescription, propertySeoTitle } from "./property-seo";

/**
 * Dados estruturados Schema.org. Regras:
 * - somente informações verificadas e visíveis na página;
 * - sem avaliações, endereço físico, coordenadas, disponibilidade ou preços inventados;
 * - nada é emitido sem a URL canônica configurada (URLs relativas não são válidas em JSON-LD).
 * Adicionar Schema.org não garante rich results.
 */

type JsonLd = Record<string, unknown>;
const CONTEXT = "https://schema.org";

export function organizationId(config: SeoConfig): string | undefined {
  const home = absoluteUrl(config, "/");
  return home ? `${home}#organization` : undefined;
}

export function organizationJsonLd(config: SeoConfig): JsonLd | null {
  const url = absoluteUrl(config, "/");
  if (!url) return null;
  return compact({
    "@context": CONTEXT,
    "@type": "RealEstateAgent",
    "@id": organizationId(config),
    name: BRAND_NAME,
    url,
    logo: absoluteUrl(config, BRAND_LOGO_PATH),
    image: absoluteUrl(config, BRAND_LOGO_PATH),
    description: SITE_DESCRIPTION,
    areaServed: { "@type": "City", name: "São Paulo" },
    // Dados oficiais fornecidos pela empresa (src/lib/config/company.ts), os mesmos exibidos no rodapé.
    email: companyInfo.email,
    telephone: companyPhoneE164(companyInfo.phones[0]),
    contactPoint: companyInfo.phones.map((phone) => ({ "@type": "ContactPoint", telephone: companyPhoneE164(phone), contactType: "customer service", areaServed: "BR", availableLanguage: "pt-BR" })),
    address: {
      "@type": "PostalAddress",
      streetAddress: companyInfo.address.street,
      addressLocality: companyInfo.address.city,
      addressRegion: companyInfo.address.state,
      postalCode: companyInfo.address.postalCode,
      addressCountry: "BR",
    },
    identifier: { "@type": "PropertyValue", propertyID: "CRECI", value: companyInfo.creci },
    parentOrganization: { "@type": "Organization", name: companyInfo.group },
    sameAs: config.organization.sameAs.length ? config.organization.sameAs : undefined,
  });
}

export function websiteJsonLd(config: SeoConfig): JsonLd | null {
  const url = absoluteUrl(config, "/");
  if (!url) return null;
  return compact({
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": `${url}#website`,
    name: BRAND_NAME,
    url,
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": organizationId(config) },
  });
}

export type Breadcrumb = { name: string; path: string };

export function breadcrumbJsonLd(items: Breadcrumb[], config: SeoConfig): JsonLd | null {
  const elements = items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(config, item.path) }));
  if (!elements.length || elements.some((element) => !element.item)) return null;
  return { "@context": CONTEXT, "@type": "BreadcrumbList", itemListElement: elements };
}

const BUSINESS_FUNCTION: Partial<Record<Property["commercial"]["purpose"], string>> = {
  SALE: "http://purl.org/goodrelations/v1#Sell",
  RENT: "http://purl.org/goodrelations/v1#LeaseOut",
};

/** RealEstateListing para imóveis publicados e elegíveis. Disponibilidade não é declarada. */
export function propertyListingJsonLd(property: Property, config: SeoConfig): JsonLd | null {
  const url = absoluteUrl(config, `/imoveis/${property.slug}`);
  if (!url) return null;
  const c = property.commercial;
  const images = property.editorial.images.map((image) => image.url).filter(isHttpsUrl).slice(0, 10);
  return compact({
    "@context": CONTEXT,
    "@type": "RealEstateListing",
    "@id": `${url}#listing`,
    url,
    name: propertySeoTitle(property),
    headline: property.editorial.title,
    description: propertySeoDescription(property),
    inLanguage: SITE_LANGUAGE,
    image: images.length ? images : undefined,
    provider: organizationId(config) ? { "@id": organizationId(config) } : undefined,
    offers: c.price > 0 ? compact({
      "@type": "Offer",
      price: c.price,
      priceCurrency: "BRL",
      businessFunction: BUSINESS_FUNCTION[c.purpose],
      seller: organizationId(config) ? { "@id": organizationId(config) } : undefined,
    }) : undefined,
    about: compact({
      "@type": "Apartment",
      name: `${PROPERTY_TYPE_LABEL[c.type]} em ${property.location.neighborhood}`,
      floorSize: c.area > 0 ? { "@type": "QuantitativeValue", value: c.area, unitCode: "MTK" } : undefined,
      numberOfBedrooms: c.bedrooms || undefined,
      numberOfBathroomsTotal: c.bathrooms || undefined,
      address: { "@type": "PostalAddress", addressLocality: property.location.city, addressRegion: property.location.state, addressCountry: "BR" },
    }),
  });
}

export type CollectionJsonLdInput = { name: string; slug: string; description: string; propertySlugs: string[] };

export function collectionPageJsonLd(input: CollectionJsonLdInput, config: SeoConfig): JsonLd | null {
  const url = absoluteUrl(config, `/colecoes/${input.slug}`);
  if (!url) return null;
  const items = input.propertySlugs.map((slug, index) => ({ "@type": "ListItem", position: index + 1, url: absoluteUrl(config, `/imoveis/${slug}`) }));
  return compact({
    "@context": CONTEXT,
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name: input.name,
    description: input.description,
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": `${absoluteUrl(config, "/")}#website` },
    mainEntity: items.length ? { "@type": "ItemList", numberOfItems: items.length, itemListElement: items } : undefined,
  });
}

/** Serializa JSON-LD com escape de "<" para impedir fechamento prematuro da tag script. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

function companyPhoneE164(phone: string): string { return `+55${phone.replace(/\D/g, "")}`; }

function compact<T extends JsonLd>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "")) as T;
}
