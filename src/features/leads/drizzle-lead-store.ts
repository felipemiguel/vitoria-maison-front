import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { curatedProperties, leadDeliveryAttempts, leadSubmissions, propertySnapshots } from "@/database/schema";
import { publicVisibilityConditions } from "@/features/properties/publication/property-publication-policy";
import type { PublicationPolicyConfig } from "@/features/properties/config";
import type { LeadDeliveryResult, LeadDeliveryStatus, LeadType } from "./types";

export class LeadRateLimitError extends Error {}
export class DuplicateLeadError extends Error { constructor(public readonly existingId:string,public readonly status:LeadDeliveryStatus){super("Esta solicitação já foi recebida recentemente.")} }

type NewLead={type:LeadType;propertyId:string|null;propertyVistaCode:string|null;vistaVehicle:string;name:string;email?:string;phone?:string;message:string;sourcePage:string;submissionKey:string;deduplicationHash:string;sessionHash:string};
export type AdminLeadFilters={type?:LeadType;status?:LeadDeliveryStatus;vistaCode?:string;from?:Date;to?:Date;page:number;pageSize:number};

export class DrizzleLeadStore {
  constructor(private readonly db:NodePgDatabase<typeof schema>,private readonly policy:PublicationPolicyConfig){}

  async resolvePublishedProperty(id:string,now:Date){const row=(await this.db.select({id:curatedProperties.id,vistaCode:curatedProperties.vistaCode,title:curatedProperties.editorialTitle,sourceTitle:propertySnapshots.sourceTitle}).from(curatedProperties).innerJoin(propertySnapshots,eq(propertySnapshots.curatedPropertyId,curatedProperties.id)).where(and(eq(curatedProperties.id,id),...publicVisibilityConditions(now,this.policy))).limit(1))[0];return row??null}

  async create(input:NewLead,now:Date):Promise<{id:string;status:LeadDeliveryStatus;created:boolean}>{
    return this.db.transaction(async(tx)=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.deduplicationHash}, 0))`);
      const existingKey=(await tx.select({id:leadSubmissions.id,status:leadSubmissions.deliveryStatus}).from(leadSubmissions).where(eq(leadSubmissions.submissionKey,input.submissionKey)).limit(1))[0];
      if(existingKey)return {...existingKey,created:false};
      const since=new Date(now.getTime()-10*60_000);
      const recentDuplicate=(await tx.select({id:leadSubmissions.id,status:leadSubmissions.deliveryStatus}).from(leadSubmissions).where(and(eq(leadSubmissions.deduplicationHash,input.deduplicationHash),gte(leadSubmissions.createdAt,since))).limit(1))[0];
      if(recentDuplicate)throw new DuplicateLeadError(recentDuplicate.id,recentDuplicate.status);
      const rate=(await tx.select({value:count()}).from(leadSubmissions).where(and(eq(leadSubmissions.sessionHash,input.sessionHash),gte(leadSubmissions.createdAt,since))))[0];
      if(Number(rate?.value??0)>=5)throw new LeadRateLimitError("Muitas solicitações em pouco tempo. Aguarde alguns minutos.");
      const row=(await tx.insert(leadSubmissions).values({...input,email:input.email??null,phone:input.phone??null,message:input.message??null}).returning({id:leadSubmissions.id,status:leadSubmissions.deliveryStatus}))[0];
      return {...row,created:true};
    });
  }

  async recordDelivery(id:string,result:LeadDeliveryResult,durationMs:number,now:Date):Promise<void>{await this.db.transaction(async(tx)=>{await tx.insert(leadDeliveryAttempts).values({leadSubmissionId:id,status:result.status,errorCode:result.errorCode,durationMs});await tx.update(leadSubmissions).set({deliveryStatus:result.status,attempts:sql`${leadSubmissions.attempts} + 1`,vistaReference:result.reference??null,lastErrorCode:result.errorCode??null,sentAt:result.status==="DELIVERED"?now:null,updatedAt:now}).where(eq(leadSubmissions.id,id))})}

  async get(id:string){const lead=(await this.db.select().from(leadSubmissions).where(eq(leadSubmissions.id,id)).limit(1))[0];if(!lead)return null;const attempts=await this.db.select().from(leadDeliveryAttempts).where(eq(leadDeliveryAttempts.leadSubmissionId,id)).orderBy(desc(leadDeliveryAttempts.attemptedAt));return {lead,attempts}}

  async list(filters:AdminLeadFilters){const conditions=[];if(filters.type)conditions.push(eq(leadSubmissions.type,filters.type));if(filters.status)conditions.push(eq(leadSubmissions.deliveryStatus,filters.status));if(filters.vistaCode)conditions.push(eq(leadSubmissions.propertyVistaCode,filters.vistaCode));if(filters.from)conditions.push(gte(leadSubmissions.createdAt,filters.from));if(filters.to)conditions.push(sql`${leadSubmissions.createdAt} < ${filters.to}`);const where=conditions.length?and(...conditions):undefined;const page=Math.max(1,filters.page);const pageSize=Math.min(50,Math.max(1,filters.pageSize));const [items,total]=await Promise.all([this.db.select().from(leadSubmissions).where(where).orderBy(desc(leadSubmissions.createdAt)).limit(pageSize).offset((page-1)*pageSize),this.db.select({value:count()}).from(leadSubmissions).where(where)]);const value=Number(total[0]?.value??0);return {items,total:value,page,pages:Math.max(1,Math.ceil(value/pageSize))}}
}
