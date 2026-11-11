import { BrokerPreviewProperty } from "@/components/broker-site/broker-site-preview";
import { authorizeAdminPreview } from "../../guard";

export const metadata = { title: "Prévia do imóvel", robots: { index: false, follow: false } };

export default async function AdminPreviewProperty({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  return <BrokerPreviewProperty siteId={id} base={await authorizeAdminPreview(id)} slug={slug}/>;
}
