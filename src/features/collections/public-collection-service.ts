import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { getDatabase } from "@/database/client";
import { collectionSlugRedirects, collections } from "@/database/schema";
import { getPropertyDataSource } from "@/features/properties/config";

export type PublicCollection = { slug:string;name:string;description:string|null;coverImageUrl:string|null;sortOrder:number;updatedAt?:Date };
const mock:PublicCollection[]=[{slug:"jardins",name:"Jardins",description:"Arquitetura, conveniência e vida a pé.",coverImageUrl:null,sortOrder:10},{slug:"alto-padrao",name:"Alto Padrão",description:"Residências singulares em São Paulo.",coverImageUrl:null,sortOrder:20},{slug:"flats-investimento",name:"Flats para Investimento",description:"Curadoria para decisões conscientes.",coverImageUrl:null,sortOrder:30},{slug:"proximos-metro",name:"Próximos ao Metrô",description:"Mobilidade no centro das escolhas.",coverImageUrl:null,sortOrder:40}];

/** Coleções publicadas. Deduplicada por requisição (home, listagem, detalhe e metadata). */
export const listPublicCollections = cache(async ():Promise<PublicCollection[]> => {
  if(getPropertyDataSource()==="mock")return mock;
  return getDatabase().select({slug:collections.slug,name:collections.name,description:collections.description,coverImageUrl:collections.coverImageUrl,sortOrder:collections.sortOrder,updatedAt:collections.updatedAt}).from(collections).where(eq(collections.published,true)).orderBy(asc(collections.sortOrder),asc(collections.name));
});

export async function findPublicCollection(slug:string):Promise<PublicCollection|null>{return (await listPublicCollections()).find(item=>item.slug===slug)??null}

/** Slug atual de uma coleção publicada que já respondeu pelo slug informado. Resolve por ID, sem cadeias. */
export async function findCollectionRedirect(oldSlug:string):Promise<string|null>{
  if(getPropertyDataSource()==="mock"||!/^[a-z0-9-]{1,160}$/.test(oldSlug))return null;
  let rows:{slug:string}[];
  try{rows=await getDatabase().select({slug:collections.slug}).from(collectionSlugRedirects).innerJoin(collections,eq(collections.id,collectionSlugRedirects.collectionId)).where(eq(collectionSlugRedirects.oldSlug,oldSlug)).limit(1)}
  catch(error){
    // Migration 0009 ainda não aplicada: responde 404 em vez de 500 e registra o alerta.
    if(isUndefinedTable(error)){console.warn(JSON.stringify({level:"warn",event:"collections.slug_redirects.table_missing"}));return null}
    throw error;
  }
  const current=rows[0]?.slug;
  if(!current||current===oldSlug)return null;
  return (await findPublicCollection(current))?current:null;
}

function isUndefinedTable(error:unknown):boolean{
  if(!error||typeof error!=="object")return false;
  const value=error as {code?:unknown;cause?:unknown};
  return value.code==="42P01"||isUndefinedTable(value.cause);
}
