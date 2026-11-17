"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/features/access/server";
import { assertSameOriginAction } from "@/features/access/request";
import { UserManagementError } from "@/features/users/errors";
import { createLandingPageService } from "@/features/landing-pages/factory";
import { publicLandingPageError } from "@/features/landing-pages/public-error";
import type { LandingTransition } from "@/features/landing-pages/landing-page-service";
import { InvalidImageError, PHOTO_MAX_INPUT_BYTES } from "@/features/media/image-processing";

export type LandingFormState = { ok?: string; error?: string };

/** Todas as ações exigem `landing-pages:manage` (ADMIN e MANAGER), verificada no servidor e no serviço. */
async function run(id: string | null, work: (ctx: { actor: Awaited<ReturnType<typeof requirePermission>>; service: ReturnType<typeof createLandingPageService> }) => Promise<string>, fallback: string): Promise<LandingFormState> {
  try {
    await assertSameOriginAction();
    const actor = await requirePermission("landing-pages:manage");
    const ok = await work({ actor, service: createLandingPageService() });
    revalidatePath("/admin/landing-pages");
    if (id) revalidatePath(`/admin/landing-pages/${id}`, "layout");
    return { ok };
  } catch (error) {
    if (error instanceof UserManagementError) return { error: error.message };
    return { error: publicLandingPageError(error, fallback) };
  }
}

const field = (form: FormData, key: string) => { const value = form.get(key); return typeof value === "string" ? value : undefined; };
const pageId = (form: FormData) => field(form, "id") ?? "";

export async function createLandingPageAction(_state: LandingFormState, form: FormData): Promise<LandingFormState> {
  let created: string | null = null;
  const result = await run(null, async ({ actor, service }) => {
    created = (await service.create(actor, { name: field(form, "name"), vistaCode: field(form, "vistaCode"), slug: field(form, "slug") })).id;
    return "Landing page criada.";
  }, "Não foi possível criar a landing page.");
  if (created) redirect(`/admin/landing-pages/${created}?criada=1`);
  return result;
}

export async function saveLandingSettingsAction(_state: LandingFormState, form: FormData): Promise<LandingFormState> {
  const id = pageId(form);
  return run(id, async ({ actor, service }) => {
    await service.updateSettings(actor, id, { version: field(form, "version"), name: field(form, "name"), slug: field(form, "slug"), whatsappNumber: field(form, "whatsappNumber"), whatsappMessage: field(form, "whatsappMessage"), seoTitle: field(form, "seoTitle"), seoDescription: field(form, "seoDescription") });
    return "Configurações salvas.";
  }, "Não foi possível salvar as configurações.");
}

export async function saveLandingContentAction(_state: LandingFormState, form: FormData): Promise<LandingFormState> {
  const id = pageId(form);
  return run(id, async ({ actor, service }) => {
    await service.updateContent(actor, id, field(form, "version"), field(form, "content") ?? "");
    return "Blocos salvos.";
  }, "Não foi possível salvar os blocos.");
}

export async function changeLandingStatusAction(_state: LandingFormState, form: FormData): Promise<LandingFormState> {
  const id = pageId(form);
  const operation = field(form, "operation") as LandingTransition;
  const messages: Record<LandingTransition, string> = { publish: "Página publicada.", unpublish: "Página despublicada (voltou para rascunho).", archive: "Página arquivada.", restore: "Página restaurada como rascunho." };
  return run(id, async ({ actor, service }) => {
    await service.transition(actor, id, field(form, "version"), operation);
    return messages[operation] ?? "Status atualizado.";
  }, "Não foi possível alterar o status.");
}

export async function duplicateLandingPageAction(_state: LandingFormState, form: FormData): Promise<LandingFormState> {
  let created: string | null = null;
  const result = await run(null, async ({ actor, service }) => { created = (await service.duplicate(actor, pageId(form))).id; return "Cópia criada."; }, "Não foi possível duplicar a página.");
  if (created) redirect(`/admin/landing-pages/${created}?copia=1`);
  return result;
}

export async function uploadLandingHeroAction(_state: LandingFormState, form: FormData): Promise<LandingFormState> {
  const id = pageId(form);
  return run(id, async ({ actor, service }) => {
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new InvalidImageError("Selecione uma imagem.");
    if (file.size > PHOTO_MAX_INPUT_BYTES) throw new InvalidImageError("A imagem deve ter no máximo 5 MB.");
    await service.setHeroImage(actor, id, Buffer.from(await file.arrayBuffer()));
    return "Imagem de topo atualizada.";
  }, "Não foi possível enviar a imagem.");
}

export async function removeLandingHeroAction(_state: LandingFormState, form: FormData): Promise<LandingFormState> {
  const id = pageId(form);
  return run(id, async ({ actor, service }) => { await service.removeHeroImage(actor, id); return "Imagem removida. O topo usa a foto principal do imóvel."; }, "Não foi possível remover a imagem.");
}
