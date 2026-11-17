import { z } from "zod";
import type { Property } from "@/features/properties/types";

/**
 * Conteúdo de uma landing page: lista ordenada de blocos prontos. Cada bloco pode ser ligado,
 * desligado e reordenado. Textos são texto puro (sem HTML): parágrafos separados por linha em
 * branco e listas com "- " no início da linha.
 *
 * Dados comerciais (preço, área, quartos, vagas, fotos, código) NUNCA são digitados: os blocos
 * "hero", "facts" e "gallery" leem do snapshot do imóvel no momento da exibição.
 */
export const CONTENT_SCHEMA_VERSION = 1;

const id = z.string().regex(/^[a-z0-9]{4,16}$/, "Identificador de bloco inválido.");
const line = (max: number, label: string) => z.string().trim().max(max, `${label}: no máximo ${max} caracteres.`);
const optionalLine = (max: number, label: string) => line(max, label).optional().default("");
const body = (label: string) => z.string().trim().max(4000, `${label}: no máximo 4.000 caracteres.`).optional().default("");
const base = { id, enabled: z.boolean() };

const heroBlock = z.object({ ...base, type: z.literal("hero"), eyebrow: optionalLine(80, "Chamada"), title: line(120, "Título"), subtitle: optionalLine(240, "Subtítulo"), ctaLabel: optionalLine(40, "Texto do botão") });
const factsBlock = z.object({ ...base, type: z.literal("facts"), title: optionalLine(80, "Título") });
const textBlock = z.object({ ...base, type: z.literal("text"), title: optionalLine(80, "Título"), body: body("Texto") });
const galleryBlock = z.object({ ...base, type: z.literal("gallery"), title: optionalLine(80, "Título"), limit: z.coerce.number().int().min(1).max(24).default(9) });
const highlightsBlock = z.object({
  ...base, type: z.literal("highlights"), title: optionalLine(80, "Título"),
  items: z.array(z.object({ title: line(80, "Diferencial"), text: optionalLine(240, "Descrição do diferencial") })).max(12, "No máximo 12 diferenciais.").transform((items) => items.filter((item) => item.title)),
});
const locationBlock = z.object({ ...base, type: z.literal("location"), title: optionalLine(80, "Título"), body: body("Texto da localização") });
const conditionsBlock = z.object({ ...base, type: z.literal("conditions"), title: optionalLine(80, "Título"), body: body("Condições") });
const faqBlock = z.object({
  ...base, type: z.literal("faq"), title: optionalLine(80, "Título"),
  items: z.array(z.object({ question: line(160, "Pergunta"), answer: line(1000, "Resposta") })).max(12, "No máximo 12 perguntas.").transform((items) => items.filter((item) => item.question && item.answer)),
});
const ctaBlock = z.object({ ...base, type: z.literal("cta"), title: line(120, "Título da chamada"), text: optionalLine(300, "Texto da chamada"), ctaLabel: optionalLine(40, "Texto do botão") });

export const blockSchema = z.discriminatedUnion("type", [heroBlock, factsBlock, textBlock, galleryBlock, highlightsBlock, locationBlock, conditionsBlock, faqBlock, ctaBlock]);
export type LandingBlock = z.infer<typeof blockSchema>;
export type LandingBlockType = LandingBlock["type"];

export const contentSchema = z.object({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION).default(CONTENT_SCHEMA_VERSION),
  blocks: z.array(blockSchema).max(20, "No máximo 20 blocos."),
}).superRefine((content, ctx) => {
  const ids = new Set<string>();
  for (const block of content.blocks) {
    if (ids.has(block.id)) ctx.addIssue({ code: "custom", message: "Blocos duplicados." });
    ids.add(block.id);
  }
  if (content.blocks.filter((block) => block.type === "hero").length > 1) ctx.addIssue({ code: "custom", message: "A página só pode ter um bloco de topo." });
  if (content.blocks.some((block, index) => block.type === "hero" && index !== 0)) ctx.addIssue({ code: "custom", message: "O bloco de topo precisa ser o primeiro." });
});
export type LandingContent = z.infer<typeof contentSchema>;

/** Conteúdo vindo do banco: inválido (ex.: versão futura) vira página vazia, nunca erro 500. */
export function parseStoredContent(value: unknown): LandingContent {
  const parsed = contentSchema.safeParse(value);
  return parsed.success ? parsed.data : { schemaVersion: CONTENT_SCHEMA_VERSION, blocks: [] };
}

export const BLOCK_LABELS: Record<LandingBlockType, { label: string; help: string }> = {
  hero: { label: "Topo", help: "Imagem grande, título, preço do Vista e botão do WhatsApp." },
  facts: { label: "Ficha do imóvel", help: "Preço, área, dormitórios, suítes e vagas, sempre do Vista." },
  text: { label: "Texto", help: "Parágrafos livres sobre o imóvel." },
  gallery: { label: "Galeria", help: "Fotos do imóvel no Vista." },
  highlights: { label: "Diferenciais", help: "Lista de pontos fortes com título e descrição curta." },
  location: { label: "Localização", help: "O bairro e a região. Não informe o endereço exato." },
  conditions: { label: "Condições", help: "Formas de pagamento ou investimento. A página mostra o aviso de valores sujeitos a alteração." },
  faq: { label: "Perguntas frequentes", help: "Perguntas e respostas." },
  cta: { label: "Chamada para o WhatsApp", help: "Faixa de destaque com botão do WhatsApp." },
};

export const ADDABLE_BLOCKS: LandingBlockType[] = ["facts", "text", "gallery", "highlights", "location", "conditions", "faq", "cta"];

export function newBlockId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 10; index += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

export function emptyBlock(type: LandingBlockType, blockId = newBlockId()): LandingBlock {
  const common = { id: blockId, enabled: true };
  switch (type) {
    case "hero": return { ...common, type, eyebrow: "", title: "", subtitle: "", ctaLabel: "Quero saber mais" };
    case "facts": return { ...common, type, title: "O imóvel" };
    case "text": return { ...common, type, title: "", body: "" };
    case "gallery": return { ...common, type, title: "Galeria", limit: 9 };
    case "highlights": return { ...common, type, title: "Diferenciais", items: [] };
    case "location": return { ...common, type, title: "Localização", body: "" };
    case "conditions": return { ...common, type, title: "Condições", body: "" };
    case "faq": return { ...common, type, title: "Perguntas frequentes", items: [] };
    case "cta": return { ...common, type, title: "Agende sua visita", text: "Fale agora com um especialista Vitória Maison.", ctaLabel: "Falar no WhatsApp" };
  }
}

/** Template inicial: já preenchido com os dados do imóvel para o usuário só ajustar os textos. */
export function defaultContent(property: Property, makeId: () => string = newBlockId): LandingContent {
  const purpose = property.commercial.purpose === "RENT" ? "para alugar" : property.commercial.purpose === "INVESTMENT" ? "para investir" : "à venda";
  const block = (type: LandingBlockType, patch: Record<string, unknown> = {}) => ({ ...emptyBlock(type, makeId()), ...patch }) as LandingBlock;
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    blocks: [
      block("hero", { eyebrow: `${property.location.neighborhood} · ${property.location.city}`, title: property.editorial.title.slice(0, 120), subtitle: `Imóvel ${purpose} com curadoria Vitória Maison.` }),
      block("facts"),
      block("text", { title: "Sobre o imóvel", body: property.editorial.description.slice(0, 4000) }),
      block("gallery"),
      block("highlights", { items: property.editorial.features.slice(0, 8).map((feature) => ({ title: feature.slice(0, 80), text: "" })) }),
      block("location", { body: `Em ${property.location.neighborhood}, ${property.location.city}.` }),
      block("faq", { enabled: false }),
      block("conditions", { enabled: false }),
      block("cta"),
    ],
  };
}

/** Texto puro → parágrafos e listas ("- item"). Nunca interpreta HTML. */
export type RichChunk = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };
export function toRichChunks(text: string): RichChunk[] {
  return text.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean).map((chunk): RichChunk => {
    const lines = chunk.split("\n").map((value) => value.trim()).filter(Boolean);
    return lines.every((value) => /^[-•]\s+/.test(value))
      ? { kind: "list", items: lines.map((value) => value.replace(/^[-•]\s+/, "")) }
      : { kind: "paragraph", text: lines.join(" ") };
  });
}
