import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./src/features/seo/legacy-redirects";

function hostnames(...values: (string | undefined)[]): string[] {
  return [...new Set(values.flatMap((value) => (value ?? "").split(",")).map((value) => value.trim().toLowerCase()).filter((value) => /^[a-z0-9.-]+$/.test(value)))];
}

/** Hosts de fotografia permitidos: Vista (snapshots) e capas editoriais aprovadas no painel. Sem curingas. */
const photoHosts = hostnames(process.env.VISTA_IMAGE_HOSTNAME, process.env.ADMIN_ALLOWED_IMAGE_HOSTNAMES);

const noIndexHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];

/**
 * Desenvolvimento de subdomínios sem DNS público: o dev server já aceita *.localhost; para lvh.me
 * (ou outro domínio local explícito em BROKER_SITES_BASE_DOMAIN) liberamos apenas esse domínio.
 * Não tem efeito em produção (allowedDevOrigins só vale para `next dev`).
 */
const brokerBase = process.env.BROKER_SITES_BASE_DOMAIN?.trim().toLowerCase();
const devOrigins = process.env.NODE_ENV !== "production" && brokerBase && /^[a-z0-9.-]+$/.test(brokerBase) ? [brokerBase, `*.${brokerBase}`] : [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Upload da foto do corretor (limite próprio de 5 MB validado no servidor + margem do multipart).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  ...(devOrigins.length ? { allowedDevOrigins: devOrigins } : {}),
  images: {
    formats: ["image/avif", "image/webp"],
    // Fotografias do Vista têm nome com hash e Cache-Control de 30 dias na origem.
    minimumCacheTTL: 2_592_000,
    remotePatterns: [
      // Imagens editoriais demonstrativas da home/sobre e dos mocks.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-**" },
      ...photoHosts.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
    ],
  },
  async headers() {
    return [
      { source: "/admin", headers: noIndexHeaders },
      { source: "/admin/:path*", headers: noIndexHeaders },
      { source: "/api/:path*", headers: noIndexHeaders },
      // Links com token: o token não deve vazar em Referer para outros sites.
      { source: "/admin/convite", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/admin/redefinir-senha", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  async redirects() {
    return LEGACY_REDIRECTS.map(({ source, destination, statusCode }) => ({ source, destination, statusCode }));
  },
};

export default nextConfig;
