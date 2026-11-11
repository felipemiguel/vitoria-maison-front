import { loadEnvConfig } from "@next/env";
import { and, inArray, lt } from "drizzle-orm";
import { closeDatabase, getDatabase } from "../../src/database/client";
import { leadSubmissions } from "../../src/database/schema";
import { getLeadConfig } from "../../src/features/leads/config";
loadEnvConfig(process.cwd());
void(async()=>{try{const {retentionDays}=getLeadConfig();const before=new Date(Date.now()-retentionDays*86_400_000);const removed=await getDatabase().delete(leadSubmissions).where(and(lt(leadSubmissions.createdAt,before),inArray(leadSubmissions.deliveryStatus,["DELIVERED","MOCKED","FAILED"]))).returning({id:leadSubmissions.id});console.log(JSON.stringify({ok:true,removed:removed.length,before:before.toISOString()}))}finally{await closeDatabase()}})();
