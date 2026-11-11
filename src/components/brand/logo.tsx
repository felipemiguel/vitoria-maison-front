import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * O arquivo original tem 2172×724 px. As dimensões declaradas (300×100) refletem o tamanho
 * máximo exibido, para que o otimizador entregue 384/640 px em vez de 3840 px.
 * O logo nunca é o elemento LCP: não recebe preload.
 */
export function Logo({ className }: { className?: string }) {
  return <Image
    src="/images/brand/vitoria-maison-logo-horizontal.png"
    alt="Vitória Maison"
    width={300}
    height={100}
    className={cn("h-auto object-contain", className)}
  />;
}
