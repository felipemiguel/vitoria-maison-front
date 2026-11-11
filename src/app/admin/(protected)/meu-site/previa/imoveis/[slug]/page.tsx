import { BrokerPreviewProperty } from "@/components/broker-site/broker-site-preview";
import { authorizeOwnPreview } from "../../guard";

export const metadata = { title: "Prévia do imóvel", robots: { index: false, follow: false } };

export default async function MyPreviewProperty({ params }: { params: Promise<{ slug: string }> }) {
  return <BrokerPreviewProperty {...await authorizeOwnPreview()} slug={(await params).slug}/>;
}
