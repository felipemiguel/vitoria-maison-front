import { BrokerPreviewHome } from "@/components/broker-site/broker-site-preview";
import { authorizeOwnPreview } from "./guard";

export const metadata = { title: "Prévia do meu site", robots: { index: false, follow: false } };

export default async function MyPreviewHome() { return <BrokerPreviewHome {...await authorizeOwnPreview()}/>; }
