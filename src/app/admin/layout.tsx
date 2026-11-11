import type { Metadata } from "next";

/** Painel, login e prévias nunca são indexados. A proteção real é a autenticação. */
export const metadata: Metadata = {
  title: { default: "Painel administrativo", template: "%s | Painel Vitória Maison" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) { return children; }
