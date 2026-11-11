import { CatalogView } from "@/components/property/catalog-view";
import { CATALOG_ROUTES, catalogMetadata } from "@/features/properties/services/catalog-service";
import type { RawSearchParams } from "@/features/seo/indexing";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props) { return catalogMetadata(CATALOG_ROUTES.rent, await searchParams); }

export default async function Page({ searchParams }: Props) {
  return <CatalogView route={CATALOG_ROUTES.rent} params={await searchParams} eyebrow="Alugar" heading="Imóveis para alugar" intro="Liberdade e praticidade, em imóveis selecionados pela nossa equipe para diferentes momentos e estilos de vida."/>;
}
