import { z } from "zod";

const schema=z.object({
  LEAD_DELIVERY_MODE:z.enum(["mock","vista"]).default("mock"),
  VISTA_LEADS_ENABLED:z.enum(["true","false"]).default("false"),
  VISTA_LEADS_ENDPOINT:z.string().regex(/^\/[a-z0-9/_-]+$/i).default("/lead"),
  VISTA_API_KEY:z.string().trim().optional(),
  VISTA_LEADS_TIMEOUT_MS:z.coerce.number().int().min(1_000).max(30_000).default(10_000),
  VISTA_API_BASE_URL:z.url().optional(),
  LEAD_RETENTION_DAYS:z.coerce.number().int().min(30).max(2_555).default(365),
});

export type LeadConfig={mode:"mock"|"vista";enabled:boolean;endpoint:string;apiKey?:string;timeoutMs:number;baseUrl?:URL;retentionDays:number};
export function getLeadConfig(env:NodeJS.ProcessEnv=process.env):LeadConfig{
  const value=schema.parse(env);const enabled=value.VISTA_LEADS_ENABLED==="true";
  if(value.LEAD_DELIVERY_MODE==="vista"&&!enabled)throw new Error("LEAD_DELIVERY_MODE=vista exige VISTA_LEADS_ENABLED=true.");
  if(value.LEAD_DELIVERY_MODE==="vista"&&(!value.VISTA_API_KEY||!value.VISTA_API_BASE_URL))throw new Error("VISTA_API_KEY e VISTA_API_BASE_URL são obrigatórias no modo Vista.");
  const baseUrl=value.VISTA_API_BASE_URL?new URL(value.VISTA_API_BASE_URL):undefined;
  if(baseUrl&&baseUrl.protocol!=="https:")throw new Error("A integração de leads exige VISTA_API_BASE_URL HTTPS.");
  return {mode:value.LEAD_DELIVERY_MODE,enabled,endpoint:value.VISTA_LEADS_ENDPOINT,apiKey:value.VISTA_API_KEY,timeoutMs:value.VISTA_LEADS_TIMEOUT_MS,baseUrl,retentionDays:value.LEAD_RETENTION_DAYS};
}
