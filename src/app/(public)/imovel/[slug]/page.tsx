import { notFound, permanentRedirect } from "next/navigation";
import { propertyRepository } from "@/features/properties/services/property-service";
import { legacyPropertyCode } from "@/features/seo/legacy-redirects";

/**
 * URLs de imóveis do site Vitória Flats: /imovel/<descricao>-<codigoVista>.
 * O número final é o código Vista (confirmado no sitemap legado). Só redireciona (308, permanente)
 * quando o mesmo imóvel está selecionado e elegível no novo site; caso contrário, 404.
 * Não há redirecionamento genérico para a home.
 */
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: true } };

export default async function LegacyProperty({ params }: { params: Promise<{ slug: string }> }) {
  const code = legacyPropertyCode((await params).slug);
  const slug = code ? await propertyRepository.findSlugByExternalCode(code) : null;
  if (!slug) notFound();
  permanentRedirect(`/imoveis/${slug}`);
}
