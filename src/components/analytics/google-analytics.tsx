"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { trackEvent } from "@/features/analytics/events";

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const first = useRef(true);

  useReportWebVitals((metric) => {
    trackEvent("web_vitals", { metric_name: metric.name, metric_id: metric.id, metric_rating: metric.rating, value: metric.name === "CLS" ? metric.value * 1000 : metric.value, non_interaction: true });
  });

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (pathname.startsWith("/admin")) return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("event", "page_view", { page_path: pathname, page_location: `${window.location.origin}${pathname}` });
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;
  const consent = process.env.NEXT_PUBLIC_ANALYTICS_CONSENT_DEFAULT === "granted" ? "granted" : "denied";
  return <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive"/>
    <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{analytics_storage:'${consent}',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('js',new Date());gtag('config','${measurementId}',{page_path:location.pathname,page_location:location.origin+location.pathname});`}</Script>
  </>;
}
