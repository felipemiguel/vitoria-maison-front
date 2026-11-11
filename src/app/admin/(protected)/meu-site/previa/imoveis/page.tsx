import { BrokerPreviewCatalog } from "@/components/broker-site/broker-site-preview";
import type { RawSearchParams } from "@/features/seo/indexing";
import { authorizeOwnPreview } from "../guard";

export const metadata = { title: "Prévia do catálogo", robots: { index: false, follow: false } };

export default async function MyPreviewCatalog({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return <BrokerPreviewCatalog {...await authorizeOwnPreview()} searchParams={await searchParams}/>;
}
