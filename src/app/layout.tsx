import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = { title: { default: "Vitória Maison | Imóveis em São Paulo", template: "%s | Vitória Maison" }, description: "Curadoria de imóveis para viver e investir em São Paulo.", robots: { index: false, follow: false }, openGraph: { title: "Vitória Maison", description: "Uma nova perspectiva sobre viver e investir.", locale: "pt_BR", type: "website" } };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><Header/><main>{children}</main><Footer/></body></html>}
