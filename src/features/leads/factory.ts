import { getDatabase } from "@/database/client";
import { getPublicationPolicyConfig } from "@/features/properties/config";
import { getLeadConfig } from "./config";
import { DrizzleLeadStore } from "./drizzle-lead-store";
import { LeadSubmissionService } from "./lead-submission-service";
import { MockLeadProvider, VistaLeadProvider } from "./providers";

export function createLeadServices(){const config=getLeadConfig();const store=new DrizzleLeadStore(getDatabase(),getPublicationPolicyConfig());const provider=config.mode==="vista"?new VistaLeadProvider(config):new MockLeadProvider();const secret=process.env.AUTH_SECRET;if(!secret)throw new Error("AUTH_SECRET não configurado.");return {config,store,provider,submission:new LeadSubmissionService(store,provider,secret,undefined,{brokerAssignmentVerification:config.brokerAssignmentEnabled})}}
