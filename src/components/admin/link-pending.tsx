"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/** Indicador dentro de um <Link>: aparece no instante do clique, enquanto a navegação não conclui. */
export function LinkPending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className="inline-flex items-center gap-1.5" aria-busy={pending || undefined}>{pending && <Loader2 size={14} className="animate-spin" aria-hidden/>}{children}{pending && <span className="sr-only">Carregando…</span>}</span>;
}
