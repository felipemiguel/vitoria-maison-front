import { getDatabase } from "@/database/client";
import { contactConfig } from "@/lib/config/contact";
import { propertyRepository } from "@/features/properties/services/property-service";
import { LandingPageService } from "./landing-page-service";

export function createLandingPageService(): LandingPageService {
  return new LandingPageService(getDatabase(), propertyRepository, { defaultWhatsapp: contactConfig.whatsappNumber });
}
