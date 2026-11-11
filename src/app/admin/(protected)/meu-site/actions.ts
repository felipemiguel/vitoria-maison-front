"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/features/access/server";
import { assertSameOriginAction } from "@/features/access/request";
import { createBrokerServices } from "@/features/brokers/factory";
import { publicBrokerError } from "@/features/brokers/public-error";
import { revalidateBrokerSites } from "@/features/brokers/revalidation";
import { BrokerError } from "@/features/brokers/errors";
import type { SubdomainAvailability } from "@/features/brokers/broker-subdomain-service";
import type { Permission } from "@/features/access/permissions";
import { InvalidImageError, PHOTO_MAX_INPUT_BYTES } from "@/features/media/image-processing";

export type BrokerFormState = { ok?: string; error?: string };

/**
 * Todas as ações operam no site/perfil do PRÓPRIO usuário, resolvidos pela sessão no servidor.
 * Nenhum ID de site ou perfil enviado pelo navegador é usado para decidir propriedade.
 */
async function run(permission: Permission, work: (ctx: { user: Awaited<ReturnType<typeof requirePermission>>; services: ReturnType<typeof createBrokerServices> }) => Promise<string>, fallback: string): Promise<BrokerFormState> {
  try {
    await assertSameOriginAction();
    const user = await requirePermission(permission);
    const ok = await work({ user, services: createBrokerServices() });
    revalidatePath("/admin/meu-site", "layout");
    await revalidateBrokerSites();
    return { ok };
  } catch (error) {
    if (error instanceof InvalidImageError) return { error: error.message };
    return { error: publicBrokerError(error, fallback) };
  }
}

async function ownSiteId(services: ReturnType<typeof createBrokerServices>, user: Awaited<ReturnType<typeof requirePermission>>): Promise<string> {
  const site = await services.sites.getOwn(user);
  if (!site) throw new BrokerError("Crie seu site primeiro.");
  return site.id;
}

async function fileBuffer(form: FormData, field: string): Promise<Buffer> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) throw new InvalidImageError("Selecione uma imagem.");
  if (file.size > PHOTO_MAX_INPUT_BYTES) throw new InvalidImageError("A imagem deve ter no máximo 5 MB.");
  return Buffer.from(await file.arrayBuffer());
}

function list(form: FormData, key: string) { return String(form.get(key) ?? "").split(",").map((item) => item.trim()).filter(Boolean); }

/** Perfil: o código Vista não é editável pelo corretor; alterar o CRECI gera solicitação de verificação. */
export async function saveOwnProfileAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  return run("broker-profile:update-own", async ({ user, services }) => {
    const input = { displayName: form.get("displayName"), professionalTitle: form.get("professionalTitle"), biography: form.get("biography"), whatsapp: form.get("whatsapp"), phone: form.get("phone"), emailPublic: form.get("emailPublic"), creci: form.get("creci"), specialties: list(form, "specialties"), serviceRegions: list(form, "serviceRegions") };
    if (await services.profiles.getOwn(user)) await services.profiles.updateOwn(user, input); else await services.profiles.createOwn(user, input);
    return "Perfil profissional salvo.";
  }, "Não foi possível salvar o perfil.");
}

export async function uploadOwnPhotoAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  return run("broker-profile:update-own", async ({ user, services }) => { await services.profiles.setPhoto(user, await fileBuffer(form, "photo")); return "Foto atualizada."; }, "Não foi possível enviar a foto.");
}

export async function removeOwnPhotoAction(): Promise<BrokerFormState> {
  return run("broker-profile:update-own", async ({ user, services }) => { await services.profiles.removePhoto(user); return "Foto removida."; }, "Não foi possível remover a foto.");
}

export async function checkSubdomainAction(value: string): Promise<SubdomainAvailability> {
  await requirePermission("broker-site:create-own");
  return createBrokerServices().subdomains.checkAvailability(value);
}

export async function createOwnSiteAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  return run("broker-site:create-own", async ({ user, services }) => { await services.sites.createOwn(user, { subdomain: form.get("subdomain"), headline: form.get("headline") }); return "Site criado em rascunho."; }, "Não foi possível criar o site.");
}

export async function updateOwnSiteAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  return run("broker-site:update-own", async ({ user, services }) => {
    await services.sites.updateContent(user, await ownSiteId(services, user), { version: form.get("version"), subdomain: form.get("subdomain") ?? undefined, headline: form.get("headline"), subtitle: form.get("subtitle"), introText: form.get("introText"), serviceText: form.get("serviceText") });
    return "Página atualizada.";
  }, "Não foi possível atualizar a página.");
}

export async function uploadHeroAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  return run("broker-site:update-own", async ({ user, services }) => { await services.sites.setHeroImage(user, await ownSiteId(services, user), await fileBuffer(form, "photo")); return "Imagem de apresentação atualizada."; }, "Não foi possível enviar a imagem.");
}

export async function removeHeroAction(): Promise<BrokerFormState> {
  return run("broker-site:update-own", async ({ user, services }) => { await services.sites.removeHeroImage(user, await ownSiteId(services, user)); return "Imagem de apresentação removida."; }, "Não foi possível remover a imagem.");
}

export async function submitOwnSiteAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  const result = await run("broker-site:submit-review", async ({ user, services }) => { await services.sites.submitForReview(user, await ownSiteId(services, user), form.get("version")); return "Solicitação enviada. Um administrador vai revisar seu site."; }, "Não foi possível solicitar a publicação.");
  if (result.ok) revalidatePath("/admin/sites-corretores");
  return result;
}

/** Adiciona um ou vários imóveis elegíveis da Maison à seleção. */
export async function addPropertiesAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  return run("broker-site:update-own", async ({ user, services }) => {
    const single = form.get("single");
    const ids = typeof single === "string" && single ? [single] : form.getAll("ids").map(String);
    const { added, skipped } = await services.sites.addProperties(user, await ownSiteId(services, user), ids);
    return added === 0 ? "Esses imóveis já estavam na sua seleção." : `${added} imóvel(is) adicionado(s)${skipped ? `; ${skipped} ignorado(s) (já selecionados ou indisponíveis)` : ""}.`;
  }, "Não foi possível adicionar os imóveis.");
}

/** Remover, destacar e ordenar itens da própria seleção. */
export async function manageSelectionAction(_state: BrokerFormState, form: FormData): Promise<BrokerFormState> {
  return run("broker-site:update-own", async ({ user, services }) => {
    const siteId = await ownSiteId(services, user);
    const propertyId = String(form.get("propertyId") ?? "");
    const op = String(form.get("op") ?? "");
    if (op === "remove") { await services.sites.removeProperty(user, siteId, propertyId); return "Imóvel removido da seleção."; }
    if (op === "feature" || op === "unfeature") { await services.sites.setFeatured(user, siteId, propertyId, op === "feature"); return op === "feature" ? "Imóvel destacado na home." : "Destaque removido."; }
    if (op === "up" || op === "down") { await services.sites.moveProperty(user, siteId, propertyId, op); return "Ordem atualizada."; }
    throw new BrokerError("Operação inválida.");
  }, "Não foi possível atualizar a seleção.");
}
