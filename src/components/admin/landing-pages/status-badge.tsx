import type { LandingPageStatus } from "@/database/schema";
import { LANDING_PAGE_STATUS_LABELS } from "@/features/landing-pages/landing-page-service";

const STYLE: Record<LandingPageStatus, string> = { PUBLISHED: "bg-emerald-50 text-emerald-800", DRAFT: "bg-[#f4ece6] text-[#66142e]", ARCHIVED: "bg-[#efefef] text-[#5f5652]" };

export function LandingStatusBadge({ status }: { status: LandingPageStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>{LANDING_PAGE_STATUS_LABELS[status]}</span>;
}
