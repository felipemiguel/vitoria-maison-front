import { getDatabase } from "@/database/client";
import { findPublicMedia } from "@/features/media/media-service";

export const dynamic = "force-dynamic";

/**
 * Entrega mídia armazenada no PostgreSQL. Cada upload gera um novo ID, então o conteúdo de um ID
 * nunca muda: cache longo e imutável. Cabeçalhos impedem interpretar o arquivo como outro tipo.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const media = await findPublicMedia(getDatabase(), (await params).id);
  if (!media) return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const etag = `"${media.sha256}"`;
  const headers = { "Content-Type": media.contentType, "Cache-Control": "public, max-age=31536000, immutable", ETag: etag, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": "inline" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(media.bytes), { headers: { ...headers, "Content-Length": String(media.bytes.length) } });
}
