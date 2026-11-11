import { BrokerPreviewCatalog } from "@/components/broker-site/broker-site-preview";
import type { RawSearchParams } from "@/features/seo/indexing";
import { authorizeAdminPreview } from "../guard";

export const metadata = { title: "Prévia do catálogo", robots: { index: false, follow: false } };

export default async function AdminPreviewCatalog({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawSearchParams> }) {
  const { id } = await params;
  return <BrokerPreviewCatalog siteId={id} base={await authorizeAdminPreview(id)} searchParams={await searchParams}/>;
}
