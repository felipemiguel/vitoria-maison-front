"use server";

import { redirect } from "next/navigation";
import { refresh as refreshRouter, revalidatePath } from "next/cache";
import { getAuthorizedAdminServices } from "@/features/admin/properties/admin-property-service-factory";
import type { AdminActionState } from "../imoveis/[id]/actions";
import { publicAdminError } from "@/features/admin/public-error";

export async function createCollectionAction(_state:AdminActionState,form:FormData):Promise<AdminActionState>{try{const {admin,collections}=await getAuthorizedAdminServices("collections:manage");const id=await collections.create(values(form),admin.id);redirect(`/admin/colecoes/${id}?criada=1`)}catch(error){return fail(error)}}
export async function updateCollectionAction(_state:AdminActionState,form:FormData):Promise<AdminActionState>{try{const {admin,collections}=await getAuthorizedAdminServices("collections:manage");await collections.update({...values(form),id:form.get("id"),version:form.get("version")},admin.id);refresh(String(form.get("id")));return {ok:"Coleção atualizada."}}catch(error){return fail(error)}}
export async function updateCollectionPropertiesAction(_state:AdminActionState,form:FormData):Promise<AdminActionState>{try{const id=String(form.get("id"));const version=Number(form.get("version"));const propertyIds=form.getAll("propertyId").map(String);const entries=propertyIds.map((propertyId,index)=>({propertyId,order:Number(form.get(`order:${propertyId}`))||index+1}));const {admin,collections}=await getAuthorizedAdminServices("collections:manage");await collections.setProperties(id,version,entries,admin.id);refresh(id);return {ok:"Imóveis da coleção atualizados."}}catch(error){return fail(error)}}
export async function saveCollectionAction(_state:AdminActionState,form:FormData):Promise<AdminActionState>{try{const id=String(form.get("id"));const version=Number(form.get("version"));const propertyIds=form.getAll("propertyId").map(String);const entries=propertyIds.map((propertyId,index)=>({propertyId,order:Number(form.get(`order:${propertyId}`))||index+1}));const {admin,collections}=await getAuthorizedAdminServices("collections:manage");await collections.save({...values(form),id,version},entries,admin.id);refresh(id);refreshRouter();return {ok:"Coleção salva com sucesso."}}catch(error){return fail(error)}}
function values(form:FormData){return {name:form.get("name"),slug:form.get("slug"),description:form.get("description"),coverImageUrl:form.get("coverImageUrl"),published:form.get("published")==="on",sortOrder:form.get("sortOrder")}}
function refresh(id:string){revalidatePath("/admin/colecoes");revalidatePath(`/admin/colecoes/${id}`);revalidatePath("/admin")}
function fail(error:unknown):AdminActionState{return {error:publicAdminError(error,"Não foi possível atualizar a coleção.")}}
