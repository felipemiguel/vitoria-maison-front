import { notFound } from "next/navigation";
import { requirePagePermission } from "@/features/access/server";
import { createLandingPageService } from "@/features/landing-pages/factory";
import { LANDING_PAGE_STATUS_LABELS, LandingPageNotFoundError } from "@/features/landing-pages/landing-page-service";
import { propertyRepository } from "@/features/properties/services/property-service";
import { LandingPageViewer } from "@/components/landing/landing-page-viewer";

export const metadata = { title: "Prévia da landing page", robots: { index: false, follow: false } };

/** Prévia autenticada com o MESMO template da página pública, em qualquer status. */
export default async function LandingPreview({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("landing-pages:manage");
  const { id } = await params;
  const { page, property } = await createLandingPageService().findForPreview(user, id).catch((error) => { if (error instanceof LandingPageNotFoundError) notFound(); throw error; });
  const alternatives = property ? [] : (await propertyRepository.list({ sort: "editorial", pageSize: 3 })).items;
  return <div className="-m-5 bg-[#f8f6f2] text-[#181817] lg:-m-8">
    <p className="sticky top-0 z-50 bg-amber-300 px-5 py-3 text-sm font-semibold text-amber-950">Prévia — status: {LANDING_PAGE_STATUS_LABELS[page.status]}. Os botões do WhatsApp funcionam normalmente.</p>
    <div className="relative"><LandingPageViewer page={page} property={property} alternatives={alternatives} preview/></div>
  </div>;
}
