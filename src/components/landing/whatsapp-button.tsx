"use client";

import { MessageCircle } from "lucide-react";
import { trackEvent } from "@/features/analytics/events";
import { cn } from "@/lib/utils";

type Variant = "primary" | "light" | "outline" | "bar";

// `!` nas cores do texto: a regra global `a{color:inherit}` (fora de @layer) venceria as utilitárias.
const STYLES: Record<Variant, string> = {
  primary: "bg-[#66142e] !text-white hover:bg-[#4d0a20]",
  light: "bg-white !text-[#66142e] hover:bg-[#f4ece6]",
  outline: "border border-[#66142e] !text-[#66142e] hover:bg-[#66142e] hover:!text-white",
  bar: "w-full bg-[#66142e] !text-white",
};

/**
 * Botão do WhatsApp da landing page. O clique dispara apenas o evento de analytics (quando o
 * GA4 está habilitado), sem dados pessoais; não gera lead registrado no banco.
 */
export function WhatsappButton({ href, label, code, sourcePage, variant = "primary", className }: { href: string | null; label: string; code?: string; sourcePage: string; variant?: Variant; className?: string }) {
  if (!href) return null;
  return <a href={href} target="_blank" rel="noopener noreferrer"
    onClick={() => trackEvent("whatsapp_click", { property_code: code, source_page: sourcePage })}
    className={cn("inline-flex min-h-[52px] items-center justify-center gap-2.5 px-7 text-[12px] font-semibold uppercase tracking-[.12em] transition", STYLES[variant], className)}>
    <MessageCircle size={18} aria-hidden/> {label}
  </a>;
}
