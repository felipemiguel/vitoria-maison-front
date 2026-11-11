import { z } from "zod";

const schema=z.object({
  LEAD_DELIVERY_MODE:z.enum(["mock","vista"]).default("mock"),
  VISTA_LEADS_ENABLED:z.enum(["true","false"]).default("false"),
  VISTA_LEADS_ENDPOINT:z.string().regex(/^\/[a-z0-9/_-]+$/i).default("/lead"),
  VISTA_API_KEY:z.string().trim().optional(),
  VISTA_LEADS_TIMEOUT_MS:z.coerce.number().int().min(1_000).max(30_000).default(10_000),
  VISTA_API_BASE_URL:z.url().optional(),
  LEAD_RETENTION_DAYS:z.coerce.number().int().min(30).max(2_555).default(365),
  BROKER_LEADS_ENABLED:z.enum(["true","false"]).default("false"),
  BROKER_VISTA_ASSIGNMENT_ENABLED:z.enum(["true","false"]).default("false"),
  // Nome do campo de corretor no POST /lead. Só é enviado com BROKER_VISTA_ASSIGNMENT_ENABLED=true e
  // depois de confirmação oficial do Vista (ver docs/vista-broker-leads.md). Vazio = nunca enviado.
  VISTA_LEAD_BROKER_FIELD:z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/,"VISTA_LEAD_BROKER_FIELD inválido.").optional().or(z.literal("").transform(()=>undefined)),
});

export type LeadConfig={mode:"mock"|"vista";enabled:boolean;endpoint:string;apiKey?:string;timeoutMs:number;baseUrl?:URL;retentionDays:number;
  /** Formulários dos sites de corretores aceitam envios. */
  brokerLeadsEnabled:boolean;
  /** Contrato de atribuição no Vista confirmado: compara o corretor retornado e (se configurado) envia o campo de corretor. */
  brokerAssignmentEnabled:boolean;
  brokerField?:string};
const RESERVED_LEAD_FIELDS=new Set(["nome","fone","email","mensagem","veiculo","anuncio"]);
/** Leitura isolada da flag (para renderização), sem validar as credenciais do Vista. */
export function brokerLeadsEnabled(env:NodeJS.ProcessEnv=process.env):boolean{return env.BROKER_LEADS_ENABLED?.trim()==="true"}
export function getLeadConfig(env:NodeJS.ProcessEnv=process.env):LeadConfig{
  const value=schema.parse(env);const enabled=value.VISTA_LEADS_ENABLED==="true";
  if(value.LEAD_DELIVERY_MODE==="vista"&&!enabled)throw new Error("LEAD_DELIVERY_MODE=vista exige VISTA_LEADS_ENABLED=true.");
  if(value.LEAD_DELIVERY_MODE==="vista"&&(!value.VISTA_API_KEY||!value.VISTA_API_BASE_URL))throw new Error("VISTA_API_KEY e VISTA_API_BASE_URL são obrigatórias no modo Vista.");
  const baseUrl=value.VISTA_API_BASE_URL?new URL(value.VISTA_API_BASE_URL):undefined;
  if(baseUrl&&baseUrl.protocol!=="https:")throw new Error("A integração de leads exige VISTA_API_BASE_URL HTTPS.");
  const brokerAssignmentEnabled=value.BROKER_VISTA_ASSIGNMENT_ENABLED==="true";
  if(value.VISTA_LEAD_BROKER_FIELD&&RESERVED_LEAD_FIELDS.has(value.VISTA_LEAD_BROKER_FIELD.toLowerCase()))throw new Error("VISTA_LEAD_BROKER_FIELD não pode sobrescrever um campo do lead.");
  return {mode:value.LEAD_DELIVERY_MODE,enabled,endpoint:value.VISTA_LEADS_ENDPOINT,apiKey:value.VISTA_API_KEY,timeoutMs:value.VISTA_LEADS_TIMEOUT_MS,baseUrl,retentionDays:value.LEAD_RETENTION_DAYS,
    brokerLeadsEnabled:value.BROKER_LEADS_ENABLED==="true",brokerAssignmentEnabled,brokerField:brokerAssignmentEnabled?value.VISTA_LEAD_BROKER_FIELD:undefined};
}
