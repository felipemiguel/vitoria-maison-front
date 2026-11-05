import type { Property, PropertyPurpose, PropertyType } from "../types";

const photos = [
  "photo-1600607687939-ce8a6c25118c", "photo-1600566753086-00f18fb6b3ea", "photo-1600210492486-724fe5c67fb0",
  "photo-1600566753190-17f0baa2a6c3", "photo-1600585154340-be6161a56a0c", "photo-1600566753051-f0b89df2dd90",
  "photo-1600566752355-35792bedcfea", "photo-1616486338812-3dadae4b4ace", "photo-1600607687920-4e2a09cf159d",
  "photo-1600607688969-a5bfcd646154", "photo-1600573472592-401b489a3cdc", "photo-1600585154526-990dced4db0d",
];
const names = [
  ["Apartamento Jardins", "Jardins", "APARTMENT", "SALE", 2450000, 178, 3],
  ["Flat com luz natural em Moema", "Moema", "FLAT", "INVESTMENT", 780000, 48, 1],
  ["Apartamento Vila Mariana", "Vila Mariana", "APARTMENT", "SALE", 1690000, 132, 3],
  ["Studio essencial em Pinheiros", "Pinheiros", "STUDIO", "SALE", 690000, 34, 1],
  ["Cobertura junto ao Ibirapuera", "Moema", "PENTHOUSE", "SALE", 4980000, 310, 4],
  ["Flat contemporâneo nos Jardins", "Jardins", "FLAT", "RENT", 8500, 62, 1],
  ["Apartamento sereno no Itaim", "Itaim Bibi", "APARTMENT", "RENT", 14500, 165, 3],
  ["Studio urbano na Vila Madalena", "Vila Madalena", "STUDIO", "RENT", 4200, 39, 1],
  ["Apartamento com varanda em Perdizes", "Perdizes", "APARTMENT", "SALE", 1380000, 118, 3],
  ["Flat próximo à Paulista", "Bela Vista", "FLAT", "INVESTMENT", 620000, 42, 1],
  ["Studio conectado à cidade", "Brooklin", "STUDIO", "INVESTMENT", 590000, 31, 1],
  ["Apartamento de linhas clássicas", "Higienópolis", "APARTMENT", "SALE", 3200000, 220, 4],
  ["Cobertura em Vila Mariana", "Vila Mariana", "PENTHOUSE", "SALE", 3650000, 245, 4],
  ["Flat mobiliado em Moema", "Moema", "FLAT", "RENT", 6100, 52, 1],
  ["Apartamento compacto em Pinheiros", "Pinheiros", "APARTMENT", "RENT", 7200, 76, 2],
  ["Studio próximo ao metrô", "Paraíso", "STUDIO", "SALE", 640000, 36, 1],
  ["Apartamento amplo no Campo Belo", "Campo Belo", "APARTMENT", "SALE", 2150000, 186, 3],
  ["Flat para investimento no Itaim", "Itaim Bibi", "FLAT", "INVESTMENT", 910000, 55, 1],
] as const;

const image = (index: number, variant = 0) => ({ url: `https://images.unsplash.com/${photos[(index + variant) % photos.length]}?auto=format&fit=crop&w=1600&q=85`, alt: `Interior do imóvel demonstrativo ${index + 1}` });

export const mockProperties: Property[] = names.map((n, i) => ({
  id: String(i + 1), slug: n[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  commercial: { purpose: n[3] as PropertyPurpose, type: n[2] as PropertyType, price: n[4], area: n[5], bedrooms: n[6], suites: n[6] > 2 ? 1 : undefined, bathrooms: Math.max(1, n[6]), parkingSpaces: n[2] === "STUDIO" ? undefined : Math.min(3, n[6]), code: `VM${String(i + 1).padStart(4, "0")}` },
  location: { neighborhood: n[1], city: "São Paulo", state: "SP" },
  editorial: { title: n[0], description: "Uma residência selecionada pela curadoria Maison, onde arquitetura, localização e conforto encontram equilíbrio.", images: [image(i), image(i, 3), image(i, 6)], features: ["Luz natural", "Planta bem resolvida", "Localização estratégica", ...(i % 2 ? ["Mobiliado"] : ["Varanda"])] },
  curation: { published: i !== 16, featured: i < 4, featuredOrder: i < 4 ? i + 1 : undefined, collections: [n[1] === "Jardins" ? "jardins" : "", n[2] === "FLAT" ? "flats-investimento" : "", n[4] > 2500000 ? "alto-padrao" : "", ["Paraíso", "Vila Mariana", "Pinheiros"].includes(n[1]) ? "proximos-metro" : ""].filter(Boolean) },
}));
