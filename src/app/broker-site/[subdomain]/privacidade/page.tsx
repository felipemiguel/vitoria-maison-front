import type { Metadata } from "next";
import PrivacyPolicy from "@/app/(public)/privacidade/page";
import { absoluteUrl, getSeoConfig } from "@/features/seo/config";

export const dynamic = "force-dynamic";

/** A política é da Vitória Maison (controladora dos dados): mesmo conteúdo, canonical na página principal. */
export function generateMetadata(): Metadata {
  const canonical = absoluteUrl(getSeoConfig(), "/privacidade");
  return { title: { absolute: "Política de Privacidade | Vitória Maison" }, robots: { index: false, follow: true }, ...(canonical ? { alternates: { canonical } } : {}) };
}

export default function BrokerSitePrivacy() { return <PrivacyPolicy/>; }
