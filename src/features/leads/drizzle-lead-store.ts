import { and, count, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/database/schema";
import { adminAuditEvents, brokerProfiles, brokerSiteProperties, brokerSites, curatedProperties, leadDeliveryAttempts, leadSubmissions, propertySnapshots } from "@/database/schema";
import { publicVisibilityConditions } from "@/features/properties/publication/property-publication-policy";
import type { PublicationPolicyConfig } from "@/features/properties/config";
import type { LeadAssignmentStatus, LeadDeliveryResult, LeadDeliveryStatus, LeadOrigin, LeadSource, LeadType } from "./types";

export class LeadRateLimitError extends Error {}
export class DuplicateLeadError extends Error { constructor(public readonly existingId:string,public readonly status:LeadDeliveryStatus){super("Esta solicitação já foi recebida recentemente.")} }

export class LeadStateError extends Error {}

type NewLead={type:LeadType;propertyId:string|null;propertyVistaCode:string|null;vistaVehicle:string;name:string;email?:string;phone?:string;message:string;sourcePage:string;submissionKey:string;deduplicationHash:string;sessionHash:string;origin:LeadOrigin};
export type AdminLeadFilters={type?:LeadType;status?:LeadDeliveryStatus;vistaCode?:string;from?:Date;to?:Date;source?:LeadSource;brokerUserId?:string;brokerSiteId?:string;assignment?:LeadAssignmentStatus;page:number;pageSize:number};
/** Escopo do painel "Meus leads": site E corretor resolvidos da sessão; nunca de parâmetros do navegador. */
export type BrokerLeadScope={brokerSiteId:string;brokerUserId:string};
export type BrokerLeadFilters={status?:LeadDeliveryStatus;assignment?:LeadAssignmentStatus;vistaCode?:string;from?:Date;to?:Date;page:number;pageSize:number};
/** Resultado de atribuição após a entrega (somente leads de site de corretor). */
export type AssignmentUpdate={status:LeadAssignmentStatus;returnedCode:string|null};
const PROPERTY_TITLE=sql<string|null>`COALESCE(NULLIF(BTRIM(${curatedProperties.editorialTitle}), ''), NULLIF(BTRIM(${propertySnapshots.sourceTitle}), ''))`;

export class DrizzleLeadStore {
  constructor(private readonly db:NodePgDatabase<typeof schema>,private readonly policy:PublicationPolicyConfig){}

  /**
   * Imóvel público da Maison. Com `brokerSiteId`, exige também que o imóvel esteja na seleção desse site
   * (mesmo escopo do catálogo do corretor): interesse em imóvel fora do site é recusado.
   */
  async resolvePublishedProperty(id:string,now:Date,brokerSiteId?:string){
    const base=this.db.select({id:curatedProperties.id,vistaCode:curatedProperties.vistaCode,title:curatedProperties.editorialTitle,sourceTitle:propertySnapshots.sourceTitle}).from(curatedProperties).innerJoin(propertySnapshots,eq(propertySnapshots.curatedPropertyId,curatedProperties.id));
    const conditions=[eq(curatedProperties.id,id),...publicVisibilityConditions(now,this.policy)];
    const row=brokerSiteId
      ?(await base.innerJoin(brokerSiteProperties,and(eq(brokerSiteProperties.curatedPropertyId,curatedProperties.id),eq(brokerSiteProperties.brokerSiteId,brokerSiteId))).where(and(...conditions)).limit(1))[0]
      :(await base.where(and(...conditions)).limit(1))[0];
    return row??null;
  }

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
      const {origin,...lead}=input;
      const broker=origin.source==="BROKER_SITE"?origin:null;
      const row=(await tx.insert(leadSubmissions).values({...lead,email:lead.email??null,phone:lead.phone??null,message:lead.message??null,
        source:origin.source,sourceHostname:origin.hostname,sourcePath:origin.path,
        brokerSiteId:broker?.brokerSiteId??null,brokerUserId:broker?.brokerUserId??null,vistaBrokerCodeRequested:broker?.vistaBrokerCode??null,
        assignmentStatus:broker?"PENDING":"NOT_APPLICABLE"}).returning({id:leadSubmissions.id,status:leadSubmissions.deliveryStatus}))[0];
      return {...row,created:true};
    });
  }

  /** Grava a tentativa (histórico) e o estado atual. A atribuição só muda enquanto estiver PENDING (nunca sobrescreve conferência manual). */
  async recordDelivery(id:string,result:LeadDeliveryResult,durationMs:number,now:Date,assignment?:AssignmentUpdate):Promise<void>{await this.db.transaction(async(tx)=>{
    await tx.insert(leadDeliveryAttempts).values({leadSubmissionId:id,status:result.status,errorCode:result.errorCode,durationMs,vistaReference:result.reference??null,vistaBrokerCodeReturned:result.brokerCode??null});
    await tx.update(leadSubmissions).set({deliveryStatus:result.status,attempts:sql`${leadSubmissions.attempts} + 1`,vistaReference:result.reference??null,lastErrorCode:result.errorCode??null,sentAt:result.status==="DELIVERED"?now:null,updatedAt:now,
      ...(assignment?{assignmentStatus:sql`CASE WHEN ${leadSubmissions.assignmentStatus} = 'PENDING' THEN ${assignment.status} ELSE ${leadSubmissions.assignmentStatus} END`,vistaBrokerCodeReturned:assignment.returnedCode}:{})}).where(eq(leadSubmissions.id,id));
  })}

  /**
   * Reserva atômica para nova tentativa: somente FAILED → PENDING. Dois cliques simultâneos não geram dois envios;
   * o segundo recebe null. Se o processo cair depois da reserva, o lead fica PENDING (visível para reconciliação).
   */
  async claimForRetry(id:string,now:Date){return (await this.db.update(leadSubmissions).set({deliveryStatus:"PENDING",updatedAt:now}).where(and(eq(leadSubmissions.id,id),eq(leadSubmissions.deliveryStatus,"FAILED"))).returning())[0]??null}

  /**
   * Reconciliação manual após conferência no Vista (resultado UNKNOWN, ou PENDING parado há mais de 10 minutos).
   * DELIVERED: o lead consta no Vista. FAILED: não consta, e passa a admitir nova tentativa. Auditado, sem dados pessoais.
   */
  async reconcileDelivery(id:string,actorId:string,outcome:"DELIVERED"|"FAILED",vistaReference:string|null,now:Date){return this.db.transaction(async(tx)=>{
    const stale=new Date(now.getTime()-10*60_000);
    const before=(await tx.select().from(leadSubmissions).where(eq(leadSubmissions.id,id)).for("update").limit(1))[0];
    if(!before)throw new LeadStateError("Lead não encontrado.");
    if(!(before.deliveryStatus==="UNKNOWN"||(before.deliveryStatus==="PENDING"&&before.updatedAt<stale)))throw new LeadStateError("Somente entregas com resultado indeterminado podem ser reconciliadas.");
    const assignment=outcome==="DELIVERED"&&before.assignmentStatus==="PENDING"?"UNVERIFIED" as const:before.assignmentStatus;
    await tx.insert(leadDeliveryAttempts).values({leadSubmissionId:id,status:outcome,errorCode:"MANUAL_RECONCILIATION",durationMs:0,vistaReference});
    await tx.update(leadSubmissions).set({deliveryStatus:outcome,vistaReference:vistaReference??before.vistaReference,lastErrorCode:outcome==="FAILED"?"NOT_FOUND_IN_VISTA":null,sentAt:outcome==="DELIVERED"?(before.sentAt??now):null,assignmentStatus:assignment,updatedAt:now}).where(eq(leadSubmissions.id,id));
    await tx.insert(adminAuditEvents).values({adminUserId:actorId,entityType:"LEAD",entityId:id,action:"LEAD_DELIVERY_RECONCILED",beforeState:{deliveryStatus:before.deliveryStatus,vistaReference:before.vistaReference},afterState:{deliveryStatus:outcome,vistaReference:vistaReference??before.vistaReference}});
  })}

  /** Conferência comercial da atribuição no Vista (somente leads de site de corretor já entregues). Auditada. */
  async checkAssignment(id:string,actorId:string,outcome:"CONFIRMED"|"MISMATCH",observedCode:string|null,now:Date){return this.db.transaction(async(tx)=>{
    const before=(await tx.select().from(leadSubmissions).where(eq(leadSubmissions.id,id)).for("update").limit(1))[0];
    if(!before)throw new LeadStateError("Lead não encontrado.");
    if(before.source!=="BROKER_SITE")throw new LeadStateError("Somente leads de sites de corretores têm atribuição a conferir.");
    if(before.deliveryStatus!=="DELIVERED")throw new LeadStateError("Confirme a entrega no Vista antes de conferir a atribuição.");
    await tx.update(leadSubmissions).set({assignmentStatus:outcome,assignmentCheckedAt:now,assignmentCheckedBy:actorId,updatedAt:now}).where(eq(leadSubmissions.id,id));
    await tx.insert(adminAuditEvents).values({adminUserId:actorId,entityType:"LEAD",entityId:id,action:"LEAD_ASSIGNMENT_CHECKED",beforeState:{assignmentStatus:before.assignmentStatus},afterState:{assignmentStatus:outcome,observedVistaBrokerCode:observedCode,expectedVistaBrokerCode:before.vistaBrokerCodeRequested}});
  })}

  async get(id:string){const lead=(await this.db.select().from(leadSubmissions).where(eq(leadSubmissions.id,id)).limit(1))[0];if(!lead)return null;const broker=lead.brokerSiteId?(await this.db.select({subdomain:brokerSites.subdomain,displayName:brokerProfiles.displayName}).from(brokerSites).innerJoin(brokerProfiles,eq(brokerProfiles.id,brokerSites.brokerProfileId)).where(eq(brokerSites.id,lead.brokerSiteId)).limit(1))[0]??null:null;const attempts=await this.db.select().from(leadDeliveryAttempts).where(eq(leadDeliveryAttempts.leadSubmissionId,id)).orderBy(desc(leadDeliveryAttempts.attemptedAt));
    // PENDING parado há mais de 10 minutos (processo interrompido): tratado como indeterminado para reconciliação.
    const stalePending=lead.deliveryStatus==="PENDING"&&lead.updatedAt.getTime()<Date.now()-10*60_000;
    return {lead,attempts,broker,stalePending}}

  async list(filters:AdminLeadFilters){
    const conditions:SQL[]=[];
    if(filters.type)conditions.push(eq(leadSubmissions.type,filters.type));
    if(filters.status)conditions.push(eq(leadSubmissions.deliveryStatus,filters.status));
    if(filters.vistaCode)conditions.push(eq(leadSubmissions.propertyVistaCode,filters.vistaCode));
    if(filters.from)conditions.push(gte(leadSubmissions.createdAt,filters.from));
    if(filters.to)conditions.push(lt(leadSubmissions.createdAt,filters.to));
    if(filters.source)conditions.push(eq(leadSubmissions.source,filters.source));
    if(filters.brokerUserId)conditions.push(eq(leadSubmissions.brokerUserId,filters.brokerUserId));
    if(filters.brokerSiteId)conditions.push(eq(leadSubmissions.brokerSiteId,filters.brokerSiteId));
    if(filters.assignment)conditions.push(eq(leadSubmissions.assignmentStatus,filters.assignment));
    const where=conditions.length?and(...conditions):undefined;const page=Math.max(1,filters.page);const pageSize=Math.min(50,Math.max(1,filters.pageSize));
    const [items,total]=await Promise.all([
      this.db.select({lead:leadSubmissions,brokerName:brokerProfiles.displayName,subdomain:brokerSites.subdomain}).from(leadSubmissions)
        .leftJoin(brokerSites,eq(brokerSites.id,leadSubmissions.brokerSiteId)).leftJoin(brokerProfiles,eq(brokerProfiles.id,brokerSites.brokerProfileId))
        .where(where).orderBy(desc(leadSubmissions.createdAt)).limit(pageSize).offset((page-1)*pageSize),
      this.db.select({value:count()}).from(leadSubmissions).where(where)]);
    const value=Number(total[0]?.value??0);
    return {items:items.map((row)=>({...row.lead,brokerName:row.brokerName,subdomain:row.subdomain})),total:value,page,pages:Math.max(1,Math.ceil(value/pageSize))};
  }

  /** Sites com leads ou existentes, para os filtros administrativos (corretor/site). */
  async brokerSiteOptions(){return this.db.select({siteId:brokerSites.id,subdomain:brokerSites.subdomain,userId:brokerProfiles.userId,displayName:brokerProfiles.displayName}).from(brokerSites).innerJoin(brokerProfiles,eq(brokerProfiles.id,brokerSites.brokerProfileId)).orderBy(brokerProfiles.displayName)}

  private scopeWhere(scope:BrokerLeadScope){return and(eq(leadSubmissions.source,"BROKER_SITE"),eq(leadSubmissions.brokerSiteId,scope.brokerSiteId),eq(leadSubmissions.brokerUserId,scope.brokerUserId))!}

  /** Leads do próprio corretor: filtro obrigatório por site E usuário (ambos resolvidos da sessão). */
  async listForBroker(scope:BrokerLeadScope,filters:BrokerLeadFilters){
    const conditions:SQL[]=[this.scopeWhere(scope)];
    if(filters.status)conditions.push(eq(leadSubmissions.deliveryStatus,filters.status));
    if(filters.assignment)conditions.push(eq(leadSubmissions.assignmentStatus,filters.assignment));
    if(filters.vistaCode)conditions.push(eq(leadSubmissions.propertyVistaCode,filters.vistaCode));
    if(filters.from)conditions.push(gte(leadSubmissions.createdAt,filters.from));
    if(filters.to)conditions.push(lt(leadSubmissions.createdAt,filters.to));
    const where=and(...conditions);const page=Math.max(1,filters.page);const pageSize=Math.min(50,Math.max(1,filters.pageSize));
    const [items,total]=await Promise.all([
      this.db.select({id:leadSubmissions.id,type:leadSubmissions.type,createdAt:leadSubmissions.createdAt,name:leadSubmissions.name,email:leadSubmissions.email,phone:leadSubmissions.phone,message:leadSubmissions.message,
        sourceHostname:leadSubmissions.sourceHostname,sourcePath:leadSubmissions.sourcePath,propertyVistaCode:leadSubmissions.propertyVistaCode,propertyTitle:PROPERTY_TITLE,
        deliveryStatus:leadSubmissions.deliveryStatus,assignmentStatus:leadSubmissions.assignmentStatus,vistaReference:leadSubmissions.vistaReference}).from(leadSubmissions)
        .leftJoin(curatedProperties,eq(curatedProperties.id,leadSubmissions.propertyId)).leftJoin(propertySnapshots,eq(propertySnapshots.curatedPropertyId,curatedProperties.id))
        .where(where).orderBy(desc(leadSubmissions.createdAt)).limit(pageSize).offset((page-1)*pageSize),
      this.db.select({value:count()}).from(leadSubmissions).where(where)]);
    const value=Number(total[0]?.value??0);
    return {items,total:value,page,pages:Math.max(1,Math.ceil(value/pageSize))};
  }

  /** Indicadores reais do painel "Meu site". Cliques no WhatsApp não são leads e não entram aqui. */
  async brokerStats(scope:BrokerLeadScope,now:Date){
    const where=this.scopeWhere(scope);const since=new Date(now.getTime()-30*24*60*60_000);
    const [totals,byProperty]=await Promise.all([
      this.db.select({
        total:count(),
        last30:sql<number>`count(*) FILTER (WHERE ${leadSubmissions.createdAt} >= ${since})`,
        delivered:sql<number>`count(*) FILTER (WHERE ${leadSubmissions.deliveryStatus} = 'DELIVERED')`,
        assignmentPending:sql<number>`count(*) FILTER (WHERE ${leadSubmissions.assignmentStatus} IN ('PENDING','UNVERIFIED'))`,
        mismatch:sql<number>`count(*) FILTER (WHERE ${leadSubmissions.assignmentStatus} = 'MISMATCH')`,
      }).from(leadSubmissions).where(where),
      this.db.select({code:leadSubmissions.propertyVistaCode,title:sql<string|null>`max(${PROPERTY_TITLE})`,total:count()}).from(leadSubmissions)
        .leftJoin(curatedProperties,eq(curatedProperties.id,leadSubmissions.propertyId)).leftJoin(propertySnapshots,eq(propertySnapshots.curatedPropertyId,curatedProperties.id))
        .where(and(where,sql`${leadSubmissions.propertyVistaCode} IS NOT NULL`)).groupBy(leadSubmissions.propertyVistaCode).orderBy(desc(count())).limit(5),
    ]);
    const row=totals[0];
    return {total:Number(row?.total??0),last30:Number(row?.last30??0),delivered:Number(row?.delivered??0),assignmentPending:Number(row?.assignmentPending??0),mismatch:Number(row?.mismatch??0),byProperty:byProperty.map((item)=>({code:item.code!,title:item.title,total:Number(item.total)}))};
  }
}
