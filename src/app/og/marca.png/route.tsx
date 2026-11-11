import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DEFAULT_SHARE_IMAGE_SIZE } from "@/features/seo/config";

/** Imagem de compartilhamento padrão da marca (1200×630), gerada no build. Usada só quando não há fotografia real. */
export const dynamic = "force-static";

export async function GET() {
  const logo = await readFile(join(process.cwd(), "public/images/brand/vitoria-maison-logo-horizontal.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8f6f2", borderBottom: "18px solid #66142e" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={651} height={217} alt=""/>
      <div style={{ marginTop: 36, fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: "#66142e" }}>Imóveis selecionados em São Paulo</div>
    </div>,
    { ...DEFAULT_SHARE_IMAGE_SIZE, headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } },
  );
}
