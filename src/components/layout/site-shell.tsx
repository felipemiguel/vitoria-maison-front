"use client";

import { usePathname } from "next/navigation";

/**
 * Header e footer chegam prontos do servidor (props), então o footer não é hidratado
 * e o header só hidrata o menu móvel.
 */
export function SiteShell({ children, header, footer }: { children: React.ReactNode; header: React.ReactNode; footer: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return <>{children}</>;
  return <>{header}<main>{children}</main>{footer}</>;
}
