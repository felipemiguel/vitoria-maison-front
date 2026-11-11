import type { BrokerSiteView } from "@/features/brokers/public-site-service";
import type { Property, PropertyFacets } from "@/features/properties/types";
import { BrokerAbout } from "./broker-about";
import { BrokerContact } from "./broker-contact";
import { BrokerHero } from "./broker-hero";
import { BrokerPropertySection } from "./broker-property-section";
import { BrokerFindSection } from "./broker-search";
import { BrokerSpecialties } from "./broker-specialties";
import type { BrokerLinks } from "./links";

/** Home do corretor (seis seções). Usada no site público e na prévia autenticada (links inertes). */
export function BrokerHome({ site, featured, total, facets, links, preview = false }: { site: BrokerSiteView; featured: Property[]; total: number; facets: PropertyFacets; links: BrokerLinks; preview?: boolean }) {
  return <>
    <BrokerHero site={site} links={links}/>
    <BrokerPropertySection name={site.displayName} properties={featured} total={total} links={links} introText={site.introText}/>
    <BrokerFindSection facets={facets} action={links.catalog}/>
    <BrokerSpecialties specialties={site.specialties} regions={site.serviceRegions}/>
    <BrokerAbout site={site} links={links}/>
    <BrokerContact site={site} preview={preview}/>
  </>;
}
