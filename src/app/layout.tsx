import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@/components/analytics/analytics";
import { BRAND_NAME, SITE_DESCRIPTION, SITE_LOCALE, SITE_TAGLINE, getSeoConfig } from "@/features/seo/config";
import { defaultShareImage, robotsFor } from "@/features/seo/metadata";

export function generateMetadata(): Metadata {
  const config = getSeoConfig();
  const image = defaultShareImage();
  return {
    ...(config.siteUrl ? { metadataBase: config.siteUrl } : {}),
    applicationName: BRAND_NAME,
    title: { default: `${BRAND_NAME} | ${SITE_TAGLINE}`, template: `%s | ${BRAND_NAME}` },
    description: SITE_DESCRIPTION,
    robots: robotsFor(true, config),
    openGraph: { siteName: BRAND_NAME, locale: SITE_LOCALE, type: "website", images: [image] },
    twitter: { card: "summary_large_image", images: [{ url: image.url, alt: image.alt }] },
    formatDetection: { telephone: false, email: false, address: false },
    ...(config.googleSiteVerification ? { verification: { google: config.googleSiteVerification } } : {}),
  };
}

export const viewport: Viewport = { themeColor: "#f8f6f2" };

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}<Analytics/></body></html>}
