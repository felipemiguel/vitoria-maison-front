"use server";

import { refresh as refreshRouter, revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthorizedAdminServices } from "@/features/admin/properties/admin-property-service-factory";
import { enforceAdminVistaRateLimit } from "@/features/admin/auth/admin-operation-rate-limit";
import { revalidatePublicCatalog } from "@/features/admin/revalidation";
import { publicAdminError } from "@/features/admin/public-error";
import { availabilityDisplay } from "@/features/admin/properties/availability-display";
import { hasPermission } from "@/features/access/permissions";

export type AdminActionState = { ok?: string; error?: string };
const baseSchema = z.object({ id: z.string().uuid(), code: z.string().min(1).max(80) });

export async function saveAndPublishPropertyAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const id=String(form.get("id"));
  try {
    const data=baseSchema.extend({version:z.coerce.number().int().nonnegative()}).parse({id:form.get("id"),code:form.get("code"),version:form.get("version")});
    const services=await getAuthorizedAdminServices("properties:edit","properties:publish");
    const before=await services.property.getById(data.id);
    if(!before)return {error:"Imóvel não encontrado."};
    await services.curation.updateEditorial({id:data.id,version:data.version,title:form.get("title"),description:form.get("description"),purpose:form.get("purpose")||null,coverUrl:form.get("coverUrl")},services.admin.id);

    const selectedAvailability=z.enum(["UNKNOWN","AVAILABLE"]).optional().parse(form.get("availability")||undefined);
    if(before.availabilityStatus==="UNKNOWN"&&selectedAvailability){
      const currentManual=availabilityDisplay(before)==="MANUAL_CONFIRMED"?"AVAILABLE":"UNKNOWN";
      if(selectedAvailability!==currentManual){
        if(selectedAvailability==="AVAILABLE")await services.publication.confirmAvailability(data.code,services.admin.email,new Date(),"MANUAL_ADMIN");
        else await services.publication.clearAvailabilityConfirmation(data.code,services.admin.email,new Date());
      }
    }

    const decision=await services.publication.publish(data.code,new Date(),services.admin.email);
    if(!decision.allowed){refreshPaths(id);refreshRouter();return {error:`Curadoria salva, mas a publicação foi bloqueada: ${decision.reasons.join(" ")}`};}

    const featured=form.get("featured")==="on";const order=featured?form.get("order"):null;
    const current=await services.property.getById(data.id);
    if(!current)throw new Error("Imóvel não encontrado após a publicação.");
    const normalizedOrder=featured?Number(order):null;
    if(current.featured!==featured||(featured&&current.featuredOrder!==normalizedOrder)){
      await services.curation.updateFeatured({id:data.id,version:current.publicationVersion,featured,order},services.admin.id);
    }
    refreshPaths(id);refreshRouter();return {ok:"Curadoria salva e imóvel publicado com sucesso."};
  } catch(error){refreshPaths(id);return failure(error)}
}

export async function updateEditorialAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    const { admin, curation, publication } = await getAuthorizedAdminServices("properties:edit");
    await curation.updateEditorial({ id: form.get("id"), version: form.get("version"), title: form.get("title"), description: form.get("description"), purpose: form.get("purpose") || null, coverUrl: form.get("coverUrl") }, admin.id);
    const id=String(form.get("id"));
    const availability=z.enum(["UNKNOWN","AVAILABLE"]).optional().parse(form.get("availability")||undefined);const availabilityBefore=z.enum(["UNKNOWN","AVAILABLE"]).optional().parse(form.get("availabilityBefore")||undefined);
    if(availability&&availability!==availabilityBefore){
      if(!hasPermission(admin,"properties:publish")){refreshPaths(id);refreshRouter();return {error:"Curadoria atualizada. Alterar a disponibilidade exige permissão de publicação."};}
      try{const code=z.string().min(1).max(80).parse(form.get("code"));if(availability==="AVAILABLE"){const result=await publication.confirmAvailability(code,admin.email,new Date(),"MANUAL_ADMIN");refreshPaths(id);refreshRouter();return {ok:`Curadoria atualizada e disponibilidade confirmada até ${result.expiresAt.toLocaleDateString("pt-BR")}.`};}await publication.clearAvailabilityConfirmation(code,admin.email,new Date());refreshPaths(id);refreshRouter();return {ok:"Curadoria atualizada e confirmação manual removida."};}
      catch(error){refreshPaths(id);refreshRouter();return {error:`Curadoria atualizada, mas a disponibilidade não foi alterada. ${publicAdminError(error)}`};}
    }
    refreshPaths(id);refreshRouter();return { ok: "Curadoria atualizada. A disponibilidade foi mantida sem alteração." };
  } catch (error) { return failure(error); }
}

export async function updateFeaturedAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    const { admin, curation } = await getAuthorizedAdminServices("properties:edit");
    const featured = form.get("featured") === "on";
    await curation.updateFeatured({ id: form.get("id"), version: form.get("version"), featured, order: featured ? form.get("order") : null }, admin.id);
    refreshPaths(String(form.get("id"))); refreshRouter();return { ok: "Destaque atualizado." };
  } catch (error) { return failure(error); }
}

export async function confirmAvailabilityAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try { const data=baseSchema.parse(Object.fromEntries(form));const {admin,publication}=await getAuthorizedAdminServices("properties:publish");const result=await publication.confirmAvailability(data.code,admin.email,new Date(),"MANUAL_ADMIN");refreshPaths(data.id);refreshRouter();return {ok:`Disponibilidade confirmada até ${result.expiresAt.toLocaleDateString("pt-BR")}.`}; } catch(error){return failure(error)}
}

export async function publishPropertyAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try { const data=baseSchema.parse(Object.fromEntries(form));const {admin,publication}=await getAuthorizedAdminServices("properties:publish");const now=new Date();const availability=z.enum(["AVAILABLE"]).optional().parse(form.get("availability")||undefined);if(availability==="AVAILABLE")await publication.confirmAvailability(data.code,admin.email,now,"MANUAL_ADMIN");const decision=await publication.publish(data.code,now,admin.email);if(!decision.allowed)return {error:decision.reasons.join(" ")};refreshPaths(data.id);refreshRouter();return {ok:availability==="AVAILABLE"?"Disponibilidade atualizada e imóvel publicado.":"Imóvel publicado."}; } catch(error){return failure(error)}
}

export async function unpublishPropertyAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try { const data=baseSchema.parse(Object.fromEntries(form));const {admin,publication}=await getAuthorizedAdminServices("properties:publish");await publication.unpublish(data.code,admin.email);refreshPaths(data.id);refreshRouter();return {ok:"Imóvel despublicado."}; } catch(error){return failure(error)}
}

export async function syncPropertyAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    const data=baseSchema.parse(Object.fromEntries(form));const services=await getAuthorizedAdminServices("properties:sync");await enforceAdminVistaRateLimit(services.admin.id);
    const before=await services.property.getById(data.id);const result=await services.sync.syncOne(data.code);const after=await services.property.getById(data.id);
    await services.curation.recordSync(data.id,services.admin.id,{lastSyncStatus:before?.lastSyncStatus,lastSyncAttemptAt:before?.lastSyncAttemptAt},{status:result.status,lastSyncStatus:after?.lastSyncStatus,lastSyncAttemptAt:after?.lastSyncAttemptAt});
    await revalidatePublicCatalog();refreshPaths(data.id);refreshRouter();
    if(result.status!=="SUCCESS")return {error:result.message??"Falha na sincronização."};
    const sourceContentChanged=before?.sourceTitle!==after?.sourceTitle||before?.sourceDescription!==after?.sourceDescription;
    return {ok:sourceContentChanged?"Imóvel sincronizado. Revise o título e a descrição recebidos do Vista antes de aplicá-los à curadoria.":"Imóvel sincronizado com o Vista. O conteúdo editorial foi preservado."};
  } catch(error){return failure(error)}
}

function refreshPaths(id:string){revalidatePath(`/admin/imoveis/${id}`);revalidatePath(`/admin/imoveis/${id}/preview`);revalidatePath("/admin/imoveis");revalidatePath("/admin")}
function failure(error:unknown):AdminActionState{return {error:publicAdminError(error)}}
