import { CatalogView } from "@/components/property/catalog-view";
import { CATALOG_ROUTES, catalogMetadata } from "@/features/properties/services/catalog-service";
import type { RawSearchParams } from "@/features/seo/indexing";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props) { return catalogMetadata(CATALOG_ROUTES.sale, await searchParams); }

export default async function Page({ searchParams }: Props) {
  return <CatalogView route={CATALOG_ROUTES.sale} params={await searchParams} eyebrow="Comprar" heading="Imóveis à venda" intro="Seu próximo lar, com a segurança da nossa curadoria: imóveis escolhidos com olhar atento à arquitetura, localização e qualidade de vida."/>;
}
