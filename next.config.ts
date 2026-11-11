import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./src/features/seo/legacy-redirects";

function hostnames(...values: (string | undefined)[]): string[] {
  return [...new Set(values.flatMap((value) => (value ?? "").split(",")).map((value) => value.trim().toLowerCase()).filter((value) => /^[a-z0-9.-]+$/.test(value)))];
}

/** Hosts de fotografia permitidos: Vista (snapshots) e capas editoriais aprovadas no painel. Sem curingas. */
const photoHosts = hostnames(process.env.VISTA_IMAGE_HOSTNAME, process.env.ADMIN_ALLOWED_IMAGE_HOSTNAMES);

const noIndexHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
