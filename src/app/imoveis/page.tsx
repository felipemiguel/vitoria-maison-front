import { CatalogView } from "@/components/property/catalog-view";
import { CATALOG_ROUTES, catalogMetadata } from "@/features/properties/services/catalog-service";
import type { RawSearchParams } from "@/features/seo/indexing";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props) { return catalogMetadata(CATALOG_ROUTES.all, await searchParams); }

export default async function Catalog({ searchParams }: Props) {
  return <CatalogView route={CATALOG_ROUTES.all} params={await searchParams} eyebrow="Curadoria Maison" heading="Imóveis selecionados" intro="Casas para diferentes momentos, escolhidas com olhar atento à arquitetura, localização e qualidade de vida."/>;
}
