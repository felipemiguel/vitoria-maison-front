import { serializeJsonLd } from "@/features/seo/json-ld";

type Data = Record<string, unknown> | null;

/** Renderiza um único bloco JSON-LD por página, ignorando entradas nulas. */
export function JsonLd({ data }: { data: Data | Data[] }) {
  const items = (Array.isArray(data) ? data : [data]).filter((item): item is Record<string, unknown> => item !== null);
  if (!items.length) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(items.length === 1 ? items[0] : items) }}/>;
}
