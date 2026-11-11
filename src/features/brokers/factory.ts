import { getDatabase } from "@/database/client";
import { propertyRepository } from "@/features/properties/services/property-service";
import { BrokerProfileService } from "./broker-profile-service";
import { BrokerSitePropertyRepository } from "./broker-site-property-repository";
import { BrokerSiteService } from "./broker-site-service";
import { BrokerSubdomainService } from "./broker-subdomain-service";
import { getBrokerSitesConfig } from "./config";
import { revalidateBrokerSites } from "./revalidation";
import { allowedImageHosts } from "./validation";

export function createBrokerServices() {
  const db = getDatabase();
  const hosts = allowedImageHosts();
  return {
    profiles: new BrokerProfileService(db, hosts),
    sites: new BrokerSiteService(db, hosts, revalidateBrokerSites),
    subdomains: new BrokerSubdomainService(db, getBrokerSitesConfig()),
    siteProperties: new BrokerSitePropertyRepository(propertyRepository),
  };
}
