import { BrokerPreviewHome } from "@/components/broker-site/broker-site-preview";
import { authorizeAdminPreview } from "./guard";

export const metadata = { title: "Prévia do site", robots: { index: false, follow: false } };

export default async function AdminPreviewHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BrokerPreviewHome siteId={id} base={await authorizeAdminPreview(id)}/>;
}
