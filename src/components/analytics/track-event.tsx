"use client";

import { useEffect } from "react";
import { trackEvent, type AnalyticsEventName, type AnalyticsParams } from "@/features/analytics/events";

/** Dispara um evento uma vez ao montar. Não renderiza nada. */
export function TrackEvent({ name, params }: { name: AnalyticsEventName; params?: AnalyticsParams }) {
  const key = JSON.stringify(params ?? {});
  useEffect(() => { trackEvent(name, JSON.parse(key) as AnalyticsParams); }, [name, key]);
  return null;
}
